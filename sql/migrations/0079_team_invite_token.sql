-- 0079  팀 초대 링크(토큰) — PROMPT-9
--
-- 지금까지 팀 초대는 이메일만 남기고(invited), 그 이메일로 "따로" 가입해야 연결됐다.
-- 초대받는 사람이 사업자 정보를 처음부터 다시 넣어야 해서 번거로웠다.
-- → 초대마다 1회용 토큰을 발급해 /signup?invite=TOKEN 링크로 바로 합류하게 한다.
--   (메일 발송 인프라가 없어, 링크는 팀 페이지에서 복사해 광고주가 직접 전달한다.)
--
-- ⚠️ 범위: 토큰 발급/만료/재발급까지만. organizations 구조·소유권 이전·권한 전파는 건드리지 않는다.
--   이미 가입된 이메일이면 기존대로 즉시 active로 연결(토큰 불필요).

begin;

alter table team_members
  add column if not exists invite_token  text,
  add column if not exists token_expires timestamptz;

-- 토큰은 전역 유일(만료·소멸된 행은 null이라 인덱스에서 제외)
create unique index if not exists team_members_invite_token_key
  on team_members (invite_token) where invite_token is not null;

-- 초대/재발송 — 미가입 이메일이면 토큰+7일 만료를 발급, 이미 가입된 이메일이면 기존대로 즉시 active.
-- 재초대(on conflict)일 때는 아직 invited 상태인 경우에만 토큰을 새로 발급한다(이미 active면 유지).
create or replace function invite_team_member(p_owner_id uuid, p_email text, p_role text)
returns uuid
language plpgsql
security definer
as $$
declare
  v_member_id uuid;
  v_id uuid;
  v_token text := gen_random_uuid()::text;
begin
  select user_id into v_member_id from user_private where lower(email) = lower(p_email) limit 1;

  insert into team_members (owner_id, member_id, email, role, status, joined_at, invite_token, token_expires)
  values (
    p_owner_id, v_member_id, lower(p_email), p_role,
    case when v_member_id is not null then 'active' else 'invited' end,
    case when v_member_id is not null then now() else null end,
    case when v_member_id is not null then null else v_token end,
    case when v_member_id is not null then null else now() + interval '7 days' end
  )
  on conflict (owner_id, email) do update set
    role          = excluded.role,
    invited_at    = now(),
    invite_token  = case when team_members.status = 'invited' then v_token else team_members.invite_token end,
    token_expires = case when team_members.status = 'invited' then now() + interval '7 days' else team_members.token_expires end
  returning id into v_id;

  if v_member_id is not null then
    insert into notifications (user_id, type, kind, title, body, state)
    values (v_member_id, 'team_invite', 'team_invite', '팀에 초대됐어요', '광고주 계정에 팀원으로 초대됐어요.', 'unread');
  end if;

  return v_id;
end;
$$;

revoke execute on function invite_team_member(uuid, text, text) from public, anon, authenticated;
grant  execute on function invite_team_member(uuid, text, text) to service_role;

commit;
