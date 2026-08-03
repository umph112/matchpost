-- ⑧ 담당자 연락처
alter table profiles
  add column if not exists manager_phone text,
  add column if not exists company_phone text;

alter table campaigns
  add column if not exists manager_phone text,
  add column if not exists company_phone text;
