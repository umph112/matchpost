-- ② 제재 (sanctions)
create table if not exists sanctions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles(id),
  level       int  not null check (level between 0 and 5),
  reason      text not null,
  clause      text,
  set_by      uuid references profiles(id),  -- null = 시스템 자동
  released_at timestamptz,
  created_at  timestamptz not null default now()
);

-- 현재 유효 제재 레벨 조회용 뷰
create or replace view user_sanction_level as
  select
    user_id,
    coalesce(max(level), 0) as level
  from sanctions
  where released_at is null or released_at > now()
  group by user_id;

-- RLS
alter table sanctions enable row level security;

-- 본인 제재 이력 조회
create policy "sanctions: read own" on sanctions
  for select using (user_id = auth.uid());

-- 관리자만 insert/update
create policy "sanctions: admin write" on sanctions
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );
