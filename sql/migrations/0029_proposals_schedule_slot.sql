-- ④ 협의 날짜 변경 — 시간 단위 중첩 체크용
alter table proposals
  add column if not exists start_at     timestamptz,
  add column if not exists duration_min int default 60;
