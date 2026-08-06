-- 0063  팀 초대 (IMPLEMENT-5-DELTA.md C2)
--
-- 지금 레포엔 "한 광고주 계정에 여러 명이 접근"하는 구조가 전혀 없었다(팀/조직 테이블 없음,
-- 모든 소유권 체크가 advertiser_id = 로그인한 사용자 한 명 기준). 사용자 결정: 팀원은 새 계정으로
-- 가입해서 연결한다(공유 로그인 아님).
--
-- ⚠️ 범위: 이 마이그레이션은 초대/역할/상태 관리(팀 멤버 표·KPI)까지만 다룬다.
-- "담당자로 로그인한 사람이 실제로 오너의 캠페인·제안에 접근"하는 권한 전파(advertiser_id 기준
-- 조회가 걸린 앱 전역 15개 이상 지점 + RLS)는 별도의 보안 검토가 필요한 큰 작업이라 포함하지
-- 않았다 — docs/design/d5/GAPS-FOR-NEXT-ROUND.md 참고.

begin;

create table if not exists team_members (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references profiles(id),
  member_id  uuid references profiles(id),
  email      text not null,
  role       text not null default '담당자' check (role in ('담당자', '관리자')),
  status     text not null default 'invited' check (status in ('invited', 'active', 'inactive')),
  invited_at timestamptz not null default now(),
  joined_at  timestamptz,
  created_at timestamptz not null default now(),
  unique (owner_id, email)
);

create index if not exists team_members_owner_idx on team_members(owner_id);
create index if not exists team_members_member_idx on team_members(member_id);

alter table team_members enable row level security;

drop policy if exists "owner manages own team" on team_members;
create policy "owner manages own team" on team_members
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "member reads own membership" on team_members;
create policy "member reads own membership" on team_members
  for select using (member_id = auth.uid());

-- 초대 — user_private(이메일)는 RLS로 본인만 조회 가능해서 SECURITY DEFINER로 교차 조회한다.
-- 이미 가입된 이메일이면 즉시 active로 연결, 아니면 invited로 남겨 가입 시 연결한다(회원가입 라우트).
create or replace function invite_team_member(p_owner_id uuid, p_email text, p_role text)
returns uuid
language plpgsql
security definer
as $$
declare
  v_member_id uuid;
  v_id uuid;
begin
  select user_id into v_member_id from user_private where lower(email) = lower(p_email) limit 1;

  insert into team_members (owner_id, member_id, email, role, status, joined_at)
  values (
    p_owner_id, v_member_id, lower(p_email), p_role,
    case when v_member_id is not null then 'active' else 'invited' end,
    case when v_member_id is not null then now() else null end
  )
  on conflict (owner_id, email) do update set role = excluded.role, invited_at = now()
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
