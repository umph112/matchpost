-- 0076  친구등록(connections) 경로 + 직접 등록 함수
--
-- D12 §0 결정: 별도 신규 테이블을 만들지 않고 기존 connections를 확장한다.
-- 세 경로(invite/collab/manual) 중 이번엔 collab·manual만 배선한다.
--   (invite = 캠페인 링크 초대는 공개 URL·토큰 체계가 필요해 별건. source 값만 미리 남겨둔다.)
--
-- ⚠️ 친구등록은 "대시 권한"이 아니다. a_ok=b_ok=true 로 즉시 성립하지만
--    첫 대시는 여전히 proposals 관문(양쪽 승낙)을 거친다 — 그 게이트는 건드리지 않는다.

begin;

alter table connections
  add column if not exists source text
    check (source in ('invite','collab','manual'));

-- 친구등록: 양쪽 승낙이 필요 없다. a_ok=b_ok=true 로 즉시 성립.
-- 이미 있으면 source 를 덮지 않는다(먼저 맺어진 경로가 참). manual 일 때만 상대에게 알림.
create or replace function register_connection(
  p_by_id uuid, p_other_id uuid, p_source text, p_notify boolean default false
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_a uuid := least(p_by_id, p_other_id);
  v_b uuid := greatest(p_by_id, p_other_id);
  v_id uuid;
  v_by_name text;
begin
  if p_by_id = p_other_id then
    raise exception 'cannot connect to self' using errcode = 'P0018';
  end if;
  if p_source not in ('invite','collab','manual') then
    raise exception 'invalid source' using errcode = 'P0020';
  end if;

  -- on conflict do nothing: 이미 맺어진 행은 source 포함 그대로 둔다.
  select id into v_id from connections where a_id = v_a and b_id = v_b;
  if v_id is not null then
    return v_id;
  end if;

  insert into connections (a_id, b_id, a_ok, b_ok, source)
  values (v_a, v_b, true, true, p_source)
  returning id into v_id;

  if p_notify then
    select coalesce(nullif(name, ''), '광고주') into v_by_name from profiles where id = p_by_id;
    insert into notifications (user_id, type, kind, title, body, ref_type, ref_id, state)
    values (p_other_id, 'connection_registered', 'connection_registered',
      v_by_name || '이 회원님을 친구로 등록했어요',
      '다음 캠페인 소식을 먼저 받아볼 수 있어요.',
      'connection', v_id, 'unread');
  end if;

  return v_id;
end;
$$;

revoke execute on function register_connection(uuid, uuid, text, boolean) from public, anon, authenticated;
grant  execute on function register_connection(uuid, uuid, text, boolean) to service_role;

commit;
