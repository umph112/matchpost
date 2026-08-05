-- 0052  제재(sanctions) 자동 산정 배치 — 지연 "비율" 기준, 0~3단계만 자동
--
-- 4·5단계("반복·악의 확인", "미결제 방치·사기 정황")는 문서 자체가 판단 영역으로 다룸
-- (14일 유예·서면통지 등 절차가 소프트웨어 자동화 대상이 아님) — 배치는 현재 레벨이
-- 4 이상인 유저는 건드리지 않고, 0~3단계만 지연 비율/신고 건수로 자동 산정한다.
--
-- 지연 = 늦게라도 낸 건(late_days>0) + 아직 안 낸 건(미수 — 마감 지났는데 completed_at 없음).
-- 판정 대상은 "이미 결론이 난" 체크포인트만(완료됐거나 마감이 지난 것) — 아직 마감 전인 미결제는
-- 판정하지 않는다(늦었는지 아직 모르니까).
--
-- 해제(레벨 하락)는 "미해결 미입금 신고 없음 + 최근 완료된 payment 체크포인트 3건 연속 정시"일 때만
-- — released_at을 채워 기존 상위 레벨 행을 해제하고, 목표 레벨이 0보다 크면 새 행을 쌓는다.

begin;

create or replace function run_sanction_recalc_batch()
returns table(user_id uuid, old_level int, new_level int, action text)
language plpgsql
security definer
as $$
declare
  r record;
  v_current int;
  v_last3_ontime boolean;
  v_target int;
begin
  for r in
    with judgeable as (
      select
        p.advertiser_id as uid,
        dc.late_days,
        dc.completed_at,
        (dc.completed_at is not null and dc.late_days > 0) or dc.completed_at is null as is_delayed
      from deal_checkpoints dc
      join proposals p on p.id = dc.proposal_id
      where dc.kind = 'payment'
        and dc.due_adjusted is not null
        and (dc.completed_at is not null or dc.due_adjusted < current_date)
    ),
    agg as (
      select uid,
        count(*) as total,
        count(*) filter (where is_delayed) as delayed
      from judgeable
      group by uid
    ),
    reports_agg as (
      select counterpart_id as uid,
        count(*) filter (where type = 'unpaid') as unpaid_open,
        count(*) as any_open
      from reports
      where status = 'open'
      group by counterpart_id
    )
    select
      a.uid,
      a.total,
      a.delayed,
      (a.delayed::numeric / nullif(a.total, 0)) as delay_ratio,
      coalesce(ra.unpaid_open, 0) as unpaid_open,
      coalesce(ra.any_open, 0) as any_open
    from agg a
    left join reports_agg ra on ra.uid = a.uid
  loop
    select level into v_current from user_sanction_level where user_sanction_level.user_id = r.uid;
    v_current := coalesce(v_current, 0);

    if v_current >= 4 then
      continue;
    end if;

    if r.delay_ratio >= 0.5 or r.any_open >= 2 then
      v_target := 3;
    elsif r.delay_ratio >= 0.3 or r.unpaid_open >= 1 then
      v_target := 2;
    elsif r.delay_ratio >= 0.2 then
      v_target := 1;
    else
      v_target := 0;
    end if;

    if v_target > v_current then
      insert into sanctions (user_id, level, reason, set_by)
      values (r.uid, v_target, format('자동 산정 — 결제 지연 비율 %s%%', round(r.delay_ratio * 100)), null);
      user_id := r.uid; old_level := v_current; new_level := v_target; action := 'escalated';
      return next;

    elsif v_target < v_current then
      select bool_and(late_days = 0) into v_last3_ontime
      from (
        select dc.late_days
        from deal_checkpoints dc
        join proposals p on p.id = dc.proposal_id
        where p.advertiser_id = r.uid and dc.kind = 'payment' and dc.completed_at is not null
        order by dc.completed_at desc
        limit 3
      ) last3;

      if coalesce(v_last3_ontime, false) and r.unpaid_open = 0 then
        update sanctions set released_at = now()
        where user_id = r.uid and released_at is null and level > v_target;

        if v_target > 0 then
          insert into sanctions (user_id, level, reason, set_by)
          values (r.uid, v_target, '자동 해제 — 지연 비율 개선 + 최근 3건 연속 정시', null);
        end if;

        user_id := r.uid; old_level := v_current; new_level := v_target; action := 'released';
        return next;
      end if;
    end if;
  end loop;
end;
$$;

create index if not exists sanctions_user_active_idx on sanctions(user_id, released_at);

revoke execute on function run_sanction_recalc_batch() from public, anon, authenticated;
grant  execute on function run_sanction_recalc_batch() to service_role;

commit;
