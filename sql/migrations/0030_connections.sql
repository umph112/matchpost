-- ⑤ 상호 등록 (connections)
create table if not exists connections (
  id         uuid primary key default gen_random_uuid(),
  a_id       uuid not null references profiles(id),
  b_id       uuid not null references profiles(id),
  a_ok       boolean not null default false,
  b_ok       boolean not null default false,
  created_at timestamptz not null default now(),
  -- a_id < b_id 정규화로 중복 방지
  unique (a_id, b_id),
  check (a_id < b_id)
);

-- 양쪽 ok일 때만 성립된 커넥션
create or replace view active_connections as
  select * from connections where a_ok and b_ok;

-- RLS
alter table connections enable row level security;

create policy "connections: read own" on connections
  for select using (a_id = auth.uid() or b_id = auth.uid());

-- insert: 본인이 a 또는 b 중 하나
create policy "connections: insert" on connections
  for insert with check (a_id = auth.uid() or b_id = auth.uid());

-- update: 본인 ok 필드만 (a_id면 a_ok, b_id면 b_ok)
create policy "connections: update own ok" on connections
  for update using (a_id = auth.uid() or b_id = auth.uid());

-- delete: 양쪽 모두 해제 가능
create policy "connections: delete own" on connections
  for delete using (a_id = auth.uid() or b_id = auth.uid());
