-- 0059  취소 요청 철회 (IMPLEMENT-5-DELTA.md A6)
--
-- 0053에서 요청/수락만 만들고 "내가 보낸 취소 요청을 스스로 취소"하는 경로가 빠져 있었다.
-- 확정 바가 "취소 요청 보냄 · 상대 수락 대기 / 요청 철회"로 바뀌려면 철회 액션이 필요하다.
-- 요청 시점에 이미 부과한 cancellation_count는 철회해도 되돌리지 않는다(자동확정 배치와 동일 원칙).

begin;

create or replace function withdraw_cancellation(p_cancellation_id uuid, p_by_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_by_id uuid;
begin
  select by_id into v_by_id from cancellations where id = p_cancellation_id and agreed is null;

  if v_by_id is null then
    raise exception 'not found or already resolved' using errcode = 'P0011';
  end if;
  if p_by_id <> v_by_id then
    raise exception 'only the requester can withdraw' using errcode = 'P0017';
  end if;

  delete from cancellations where id = p_cancellation_id;
end;
$$;

revoke execute on function withdraw_cancellation(uuid, uuid) from public, anon, authenticated;
grant  execute on function withdraw_cancellation(uuid, uuid) to service_role;

commit;
