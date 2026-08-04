-- 0042  배치 함수 4종 — 크론 연결은 다음 차수, 이번엔 함수 + 수동호출 API 라우트까지
-- IMPLEMENT-1-SCHEMA.md §8. trust_score 재계산은 0041의 refresh_trust_score()가 이미 그 역할을
-- 하므로 별도 함수 불필요(배치 라우트에서 바로 refresh_trust_score() 호출).
--
-- 각 함수는 대상자 집합을 WHERE로 좁혀 처리한다(전건 스캔 방지).
-- 휴면 알림 타이밍은 배치가 매일 실행된다는 전제의 근사치다(정확한 "3일 전 1회"를 보장하려면
-- 유저별 다음-발송일 추적 테이블이 필요 — 이번 범위 밖, 7일 억제창으로 중복만 막는다).

begin;

-- ── 1. 휴면 차감 배치 ────────────────────────────────────────────────
create or replace function run_dormant_decay_batch()
returns table(user_id uuid, action text)
language plpgsql
security definer
as $$
declare
  r record;
  v_days int;
  v_did  boolean;
begin
  for r in
    select id, last_visited_at from profiles where last_visited_at is not null
  loop
    v_days := extract(day from (now() - r.last_visited_at))::int;

    -- 7일: 알림만
    if v_days >= 7 and not exists (
      select 1 from notifications
      where notifications.user_id = r.id and kind = 'dormant_alert_7'
        and created_at > now() - interval '7 days'
    ) then
      insert into notifications (user_id, type, kind, title, body, state)
      values (r.id, 'dormant_alert', 'dormant_alert_7', '오랜만이에요',
              '7일간 방문이 없었어요. 계속 활동하시면 혜택을 놓치지 않아요.', 'unread');
      user_id := r.id; action := 'alert_7d'; return next;
    end if;

    -- 14일 차감 3일전 예고
    if v_days >= 11 and v_days < 14 and not exists (
      select 1 from notifications
      where notifications.user_id = r.id and kind = 'dormant_warn_14'
        and created_at > now() - interval '7 days'
    ) then
      insert into notifications (user_id, type, kind, title, body, state)
      values (r.id, 'dormant_warning', 'dormant_warn_14', '3일 후 크레딧이 차감돼요',
              '14일간 미방문 시 500C가 차감됩니다. 지금 방문하면 차감을 막을 수 있어요.', 'unread');
      user_id := r.id; action := 'warn_14d'; return next;
    end if;

    -- 14일 차감 (credit_ledger_decay 내부에서 평생 1회만 허용)
    if v_days >= 14 then
      v_did := credit_ledger_decay(r.id, 'dormant_14', 500);
      if v_did then
        user_id := r.id; action := 'decay_14d'; return next;
      end if;
    end if;

    -- 30일 주기 차감 3일전 예고(근사 — 7일 억제창)
    if v_days >= 27 and not exists (
      select 1 from notifications
      where notifications.user_id = r.id and kind = 'dormant_warn_30'
        and created_at > now() - interval '7 days'
    ) then
      insert into notifications (user_id, type, kind, title, body, state)
      values (r.id, 'dormant_warning', 'dormant_warn_30', '곧 크레딧이 차감돼요',
              '30일 이상 미방문 시 1,000C가 차감됩니다.', 'unread');
      user_id := r.id; action := 'warn_30d'; return next;
    end if;

    -- 30일 주기 차감 (credit_ledger_decay 내부에서 30일마다 1회만 허용)
    if v_days >= 30 then
      v_did := credit_ledger_decay(r.id, 'dormant_30', 1000);
      if v_did then
        user_id := r.id; action := 'decay_30d'; return next;
      end if;
    end if;
  end loop;
end;
$$;


-- ── 2. 결제 예정일 알림 배치 (D-3/D-day/D+1/D+7) ─────────────────────
create or replace function run_payment_reminder_batch()
returns table(proposal_id uuid, offset_label text)
language plpgsql
security definer
as $$
declare
  r record;
  v_diff  int;
  v_label text;
  v_group text;
begin
  for r in
    select dc.proposal_id, dc.due_adjusted, p.advertiser_id
    from deal_checkpoints dc
    join proposals p on p.id = dc.proposal_id
    where dc.kind = 'payment' and dc.completed_at is null and dc.due_adjusted is not null
  loop
    v_diff := r.due_adjusted - current_date;
    v_label := case v_diff
      when 3 then 'd-3'
      when 0 then 'd-day'
      when -1 then 'd+1'
      when -7 then 'd+7'
      else null
    end;
    if v_label is null then
      continue;
    end if;

    v_group := 'payment_reminder:' || r.proposal_id || ':' || v_label;
    if not exists (select 1 from notifications where notification_group = v_group) then
      insert into notifications (user_id, type, kind, title, body, link, ref_type, ref_id, state, notification_group)
      values (
        r.advertiser_id, 'payment_reminder', 'payment_reminder',
        case v_label
          when 'd-3' then '결제 예정일이 3일 남았어요'
          when 'd-day' then '오늘이 결제 예정일이에요'
          when 'd+1' then '결제 예정일이 지났어요'
          else '결제가 7일째 지연되고 있어요'
        end,
        '결제 등록을 확인해주세요.', '/advertiser/campaigns', 'proposal', r.proposal_id, 'unread', v_group
      );
      proposal_id := r.proposal_id; offset_label := v_label; return next;
    end if;
  end loop;
end;
$$;


-- ── 3. 주간/월간 방문 리워드 배치 ─────────────────────────────────────
create or replace function run_visit_weekly_batch()
returns table(user_id uuid)
language plpgsql
security definer
as $$
declare
  r record;
begin
  for r in
    select uvl.user_id, count(distinct uvl.visited_on) as cnt
    from user_visit_log uvl
    where uvl.visited_on >= current_date - interval '6 days'
    group by uvl.user_id
    having count(distinct uvl.visited_on) >= 5
  loop
    if not exists (
      select 1 from credit_ledger
      where credit_ledger.user_id = r.user_id and reason_code = 'visit_weekly'
        and created_at > now() - interval '7 days'
    ) then
      perform credit_ledger_grant(r.user_id, 500, 'reward', 'visit_weekly', null, null, '주간 방문 리워드');
      user_id := r.user_id; return next;
    end if;
  end loop;
end;
$$;

create or replace function run_visit_monthly_batch()
returns table(user_id uuid)
language plpgsql
security definer
as $$
declare
  r record;
begin
  for r in
    select uvl.user_id, count(distinct uvl.visited_on) as cnt
    from user_visit_log uvl
    where uvl.visited_on >= current_date - interval '29 days'
    group by uvl.user_id
    having count(distinct uvl.visited_on) >= 20
  loop
    if not exists (
      select 1 from credit_ledger
      where credit_ledger.user_id = r.user_id and reason_code = 'visit_monthly'
        and created_at > now() - interval '30 days'
    ) then
      perform credit_ledger_grant(r.user_id, 2000, 'reward', 'visit_monthly', null, null, '월간 방문 리워드');
      user_id := r.user_id; return next;
    end if;
  end loop;
end;
$$;

commit;
