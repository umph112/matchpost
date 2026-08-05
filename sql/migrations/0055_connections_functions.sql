-- 0055  B-2 상호 등록(connections) 서버 함수 — 제안/수락/해제
--
-- 스팸 방지를 위해 실제로 함께 정산 완료한 사이(proposals.settled_at is not null)만
-- 제안할 수 있게 검증한다(문서의 "① 협업 종료 시 제안" 경로만 구현 — "② 초대 링크"는
-- 별도 토큰 발급·공개 URL 체계가 필요해 이번 범위 밖).

begin;

create or replace function propose_connection(p_by_id uuid, p_other_id uuid)
returns uuid
language plpgsql
security definer
as $$
declare
  v_a uuid := least(p_by_id, p_other_id);
  v_b uuid := greatest(p_by_id, p_other_id);
  v_id uuid;
  v_a_ok boolean;
  v_b_ok boolean;
begin
  if p_by_id = p_other_id then
    raise exception 'cannot connect to self' using errcode = 'P0018';
  end if;

  if not exists (
    select 1 from proposals
    where settled_at is not null
      and (
        (advertiser_id = p_by_id and influencer_id = p_other_id)
        or (advertiser_id = p_other_id and influencer_id = p_by_id)
      )
  ) then
    raise exception 'no settled collaboration together' using errcode = 'P0019';
  end if;

  select id, a_ok, b_ok into v_id, v_a_ok, v_b_ok
  from connections where a_id = v_a and b_id = v_b;

  if v_id is null then
    insert into connections (a_id, b_id, a_ok, b_ok)
    values (v_a, v_b, p_by_id = v_a, p_by_id = v_b)
    returning id into v_id;
  else
    update connections
    set a_ok = case when p_by_id = v_a then true else a_ok end,
        b_ok = case when p_by_id = v_b then true else b_ok end
    where id = v_id;
  end if;

  insert into notifications (user_id, type, kind, title, body, ref_type, ref_id, state)
  values (p_other_id, 'connection_proposed', 'connection_proposed',
    '서로 등록을 제안했어요', '수락하면 다음부터 대시 없이 바로 메시지를 주고받을 수 있어요.',
    'connection', v_id, 'unread');

  return v_id;
end;
$$;


create or replace function respond_connection(p_connection_id uuid, p_by_id uuid, p_accept boolean)
returns void
language plpgsql
security definer
as $$
declare
  v_a uuid; v_b uuid;
begin
  select a_id, b_id into v_a, v_b from connections where id = p_connection_id;
  if v_a is null then
    raise exception 'not found' using errcode = 'P0011';
  end if;
  if p_by_id <> v_a and p_by_id <> v_b then
    raise exception 'not a party' using errcode = 'P0010';
  end if;

  if not p_accept then
    delete from connections where id = p_connection_id;
    return;
  end if;

  update connections
  set a_ok = case when p_by_id = v_a then true else a_ok end,
      b_ok = case when p_by_id = v_b then true else b_ok end
  where id = p_connection_id;

  insert into notifications (user_id, type, kind, title, body, ref_type, ref_id, state)
  values (
    case when p_by_id = v_a then v_b else v_a end,
    'connection_accepted', 'connection_accepted',
    '상호 등록이 수락됐어요', '이제 대시 없이 바로 메시지를 주고받을 수 있어요.',
    'connection', p_connection_id, 'unread'
  );
end;
$$;


create or replace function revoke_connection(p_connection_id uuid, p_by_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_a uuid; v_b uuid;
begin
  select a_id, b_id into v_a, v_b from connections where id = p_connection_id;
  if v_a is null then
    raise exception 'not found' using errcode = 'P0011';
  end if;
  if p_by_id <> v_a and p_by_id <> v_b then
    raise exception 'not a party' using errcode = 'P0010';
  end if;

  delete from connections where id = p_connection_id;
end;
$$;


revoke execute on function propose_connection(uuid, uuid) from public, anon, authenticated;
grant  execute on function propose_connection(uuid, uuid) to service_role;

revoke execute on function respond_connection(uuid, uuid, boolean) from public, anon, authenticated;
grant  execute on function respond_connection(uuid, uuid, boolean) to service_role;

revoke execute on function revoke_connection(uuid, uuid) from public, anon, authenticated;
grant  execute on function revoke_connection(uuid, uuid) to service_role;

commit;
