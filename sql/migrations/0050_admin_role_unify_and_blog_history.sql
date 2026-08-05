-- 0050  관리자 판정을 role='admin'으로 통일 + 블로그 이력 테이블 정본 정리
--
-- 점검 중 실제로 확인된 문제: 이 프로젝트엔 관리자 판정 방식이 두 개 섞여 있었다.
--   - role='admin' — 실제로 작동하는 쪽. /admin/dashboard, /admin/users, /admin/credits,
--     로그인 리다이렉트 전부 이 기준. 실제 관리자 계정도 role='admin'.
--   - is_admin=true — 0013에서 추가된 뒤 단 한 번도 true로 설정된 적이 없음(DB에서 실측 확인).
--     requireAdmin.ts 기반 API 라우트 전부·이 아래 4개 RLS 정책·0048의 에스컬레이션 알림이
--     전부 이걸 썼는데, 그동안 실제 관리자에게도 작동한 적이 없었다는 뜻.
--
-- is_admin 컬럼은 지우지 않고 남겨둔다(참조만 전부 제거) — 사용하지 않음으로 주석만 남김.
--
-- 겸사겸사: blog_score_history(0033)는 정본에서 제외하고 blog_analytics_history(0049)를
-- 정본으로 쓴다. 0033은 건드리지 않고 죽은 채로 둔다 — score_version만 0049 쪽에 옮겨 붙인다.

begin;

-- ── 1. is_admin 컬럼 — 삭제하지 않고 "사용하지 않음" 표시만 ──────────────
comment on column profiles.is_admin is
  '사용하지 않음 — 관리자 판정은 profiles.role = ''admin'' 사용 (2026-08 확인: is_admin은 한 번도 true로 설정된 적 없음)';


-- ── 2. reviews_select_admin (0035) ──────────────────────────────────
drop policy if exists "reviews_select_admin" on reviews;
create policy "reviews_select_admin" on reviews
  for select using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );


-- ── 3. payment_due_changes_select (0037) ────────────────────────────
drop policy if exists "payment_due_changes_select" on payment_due_changes;
create policy "payment_due_changes_select" on payment_due_changes
  for select using (
    exists (
      select 1 from proposals p
      where p.id = proposal_id
        and (auth.uid() = p.advertiser_id or auth.uid() = p.influencer_id)
    )
    or exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );


-- ── 4. tax_consents_select_admin / tax_export_log_select_admin (0038) ──
drop policy if exists "tax_consents_select_admin" on tax_consents;
create policy "tax_consents_select_admin" on tax_consents
  for select using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

drop policy if exists "tax_export_log_select_admin" on tax_export_log;
create policy "tax_export_log_select_admin" on tax_export_log
  for select using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );


-- ── 5. trust_score_select_own (0041) ────────────────────────────────
drop policy if exists "trust_score_select_own" on trust_score;
create policy "trust_score_select_own" on trust_score
  for select using (
    auth.uid() = user_id
    or exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );


-- ── 6. re_settle_campaign(0048) — 에스컬레이션 알림 대상 교체 ──────────
-- 본문은 0048과 동일, profiles where is_admin = true → role = 'admin'만 변경
create or replace function re_settle_campaign(p_proposal_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v   proposals%rowtype;
  cp  deal_checkpoints%rowtype;
  v_now timestamptz := now();
  v_attempt_no int;
  v_late int;
begin
  select * into v from proposals where id = p_proposal_id for update;
  if not found then
    raise exception 'proposal not found' using errcode = 'P0002';
  end if;
  if v.settled_at is null then
    raise exception 'not settled yet' using errcode = 'P0006';
  end if;
  if v.paid_disputed_at is null then
    raise exception 'no dispute to resolve' using errcode = 'P0007';
  end if;

  select coalesce(max(attempt_no), 0) into v_attempt_no
    from settlement_attempts where proposal_id = p_proposal_id;

  if v_attempt_no = 0 then
    insert into settlement_attempts (proposal_id, attempt_no, recorded_at, disputed_at, resolved_at)
    values (p_proposal_id, 1, v.settled_at, v.paid_disputed_at, v_now);
    v_attempt_no := 1;
  else
    update settlement_attempts
    set resolved_at = v_now
    where proposal_id = p_proposal_id and attempt_no = v_attempt_no and resolved_at is null;
  end if;

  insert into settlement_attempts (proposal_id, attempt_no, recorded_at)
  values (p_proposal_id, v_attempt_no + 1, v_now);

  update proposals
  set paid_disputed_at = null, paid_confirmed_at = null
  where id = p_proposal_id;

  select * into cp
  from deal_checkpoints
  where proposal_id = p_proposal_id and kind = 'payment';

  if found then
    v_late := case
      when cp.due_adjusted is not null
        then greatest(0, (v_now::date - cp.due_adjusted) - 3)
      else 0
    end;
    update deal_checkpoints
    set completed_at = v_now, late_days = v_late
    where id = cp.id;
  end if;

  if v_attempt_no + 1 > 2 then
    insert into notifications (user_id, type, kind, title, body, ref_type, ref_id, state)
    select
      id, 'ops_escalation', 'ops_escalation',
      '재정산 3회 이상 — 확인이 필요해요',
      '정산이 ' || (v_attempt_no + 1) || '회째 다시 기록되고 있어요.',
      'proposal', p_proposal_id, 'unread'
    from profiles where role = 'admin';
  end if;

  insert into notifications (user_id, type, kind, title, body, link, ref_type, ref_id, state)
  values (
    v.influencer_id, 'paid_confirm_request', 'paid_confirm_request',
    '광고주가 정산을 다시 기록했어요', '입금을 확인해주세요.',
    '/influencer/earnings', 'proposal', p_proposal_id, 'unread'
  );
end;
$$;


-- ── 7. blog_analytics_history를 정본으로 — score_version 컬럼 추가 ──────
-- blog_score_history(0033)는 건드리지 않고 죽은 채로 둔다.
alter table blog_analytics_history
  add column if not exists score_version int not null default 1;

commit;
