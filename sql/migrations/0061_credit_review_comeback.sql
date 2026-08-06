-- 0061  크레딧 정책 — 빠져 있던 훅 2개 (SPEC-B-SETTLE.md §4/§6)
--
-- creditConfig.ts에는 이미 적혀 있었지만 실제 트리거/배치가 없던 두 가지:
-- review(리뷰 작성 1,000C, 종료 후 7일 이내) / comeback(30일 공백 후 복귀 1,000C, 1회).
-- 나머지(welcome/profile_complete/first_action/encourage/celebrate/deal_complete/
-- visit_weekly/visit_monthly/dormant_14/dormant_30)는 0018/0024/0042에 이미 있어 손대지 않는다.

begin;

-- review — 대리입력(is_imputed) 리뷰는 실제 작성이 아니므로 지급하지 않는다
create or replace function trg_fn_credit_review()
returns trigger language plpgsql security definer as $$
declare
  v_settled_at timestamptz;
begin
  if coalesce(new.is_imputed, false) = false then
    select settled_at into v_settled_at from proposals where id = new.proposal_id;
    if v_settled_at is not null and now() <= v_settled_at + interval '7 days' then
      perform credit_ledger_grant(new.rater_id, 1000, 'reward', 'review', 'review', new.id, '리뷰 작성 크레딧');
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_review_credit on reviews;
create trigger trg_review_credit
  after insert on reviews
  for each row execute function trg_fn_credit_review();

-- comeback — 오늘 방문했고, 그 직전 방문이 30일 이상 전이었으면 1회 지급
create or replace function run_comeback_batch()
returns table(user_id uuid)
language plpgsql
security definer
as $$
declare
  r record;
  v_prev date;
begin
  for r in
    select distinct uvl.user_id from user_visit_log uvl where uvl.visited_on = current_date
  loop
    select max(visited_on) into v_prev
    from user_visit_log
    where user_visit_log.user_id = r.user_id and visited_on < current_date;

    if v_prev is not null and current_date - v_prev >= 30 then
      if not exists (
        select 1 from credit_ledger
        where credit_ledger.user_id = r.user_id and reason_code = 'comeback'
          and created_at::date > v_prev
      ) then
        perform credit_ledger_grant(r.user_id, 1000, 'reward', 'comeback', null, null, '복귀 크레딧');
        user_id := r.user_id;
        return next;
      end if;
    end if;
  end loop;
end;
$$;

revoke execute on function run_comeback_batch() from public, anon, authenticated;
grant  execute on function run_comeback_batch() to service_role;

commit;
