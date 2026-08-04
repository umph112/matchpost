-- 0038  세무 연계 준비 — 제3자 제공 동의 + 추출 로그
-- IMPLEMENT-1-SCHEMA.md §7. 보안 지시: 이 두 테이블은 admin만 SELECT(본인도 클라이언트로 직접 조회 불가).
-- 이번 차수는 스키마만 — 동의 UI/추출 기능은 다음 차수.

begin;

create table if not exists tax_consents (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id),
  accountant_id uuid references auth.users(id),
  fields       text[] not null default '{}',
  purpose      text,
  retention    text,
  agreed_at    timestamptz not null default now(),
  revoked_at   timestamptz
);

create index if not exists tax_consents_user_idx on tax_consents(user_id);

alter table tax_consents enable row level security;

drop policy if exists "tax_consents_select_admin" on tax_consents;
create policy "tax_consents_select_admin" on tax_consents
  for select using (
    exists (select 1 from profiles where id = auth.uid() and is_admin = true)
  );

-- 동의는 사용자 본인의 행위여야 하므로 본인 insert만 허용(조회는 admin만)
drop policy if exists "tax_consents_insert_own" on tax_consents;
create policy "tax_consents_insert_own" on tax_consents
  for insert with check (auth.uid() = user_id);


create table if not exists tax_export_log (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id),
  accountant_id uuid references auth.users(id),
  period        text,
  fields        text[] not null default '{}',
  exported_at   timestamptz not null default now()
);

create index if not exists tax_export_log_user_idx on tax_export_log(user_id);

alter table tax_export_log enable row level security;

drop policy if exists "tax_export_log_select_admin" on tax_export_log;
create policy "tax_export_log_select_admin" on tax_export_log
  for select using (
    exists (select 1 from profiles where id = auth.uid() and is_admin = true)
  );
-- insert 정책 없음 — service_role(향후 export 기능) 전용

commit;
