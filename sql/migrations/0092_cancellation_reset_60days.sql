-- 0092  취소 카운트 리셋 기간 90일 → 60일
--
-- 0053이 90일로 잡았는데, 확정된 정책은 60일이다(인플루언서 취소가 실무상 흔해
-- 90일은 낙인이 너무 오래 남는다). 화면 문구도 「60일 동안 취소가 없으면 사라집니다」로
-- 안내하므로, 배치가 90일이면 문구가 사용자에게 거짓말을 하게 된다.
--
-- src/lib/cancellation/thresholds.ts 의 RESET_DAYS = 60 과 여기 interval 은 같은 값이어야
-- 한다. 한쪽만 고치지 말 것.
--
-- 0053은 손대지 않고 여기서 재정의한다(마이그레이션 소급 수정 금지).

begin;

create or replace function run_cancellation_count_reset_batch()
returns table(user_id uuid)
language plpgsql
security definer
as $$
declare r record;
begin
  for r in
    select id from profiles
    where cancellation_count > 0
      and last_cancellation_at is not null
      and last_cancellation_at < now() - interval '60 days'
  loop
    update profiles set cancellation_count = 0 where id = r.id;
    user_id := r.id;
    return next;
  end loop;
end;
$$;

revoke execute on function run_cancellation_count_reset_batch() from public, anon, authenticated;
grant  execute on function run_cancellation_count_reset_batch() to service_role;

commit;
