-- 0036  결제 조건을 "규칙"으로 받는다 — 날짜 직접입력 대신 조건 타입+값
-- IMPLEMENT-1-SCHEMA.md §2. 기존 payment_due_date(달력 직접입력)는 fixed_date 타입일 때만
-- 쓰는 컬럼으로 의미를 좁히고, payment_due_rule은 강제되지 않는 선택적 보충 메모로 격하한다.

begin;

alter table campaigns
  add column if not exists payment_term_type text
    not null default 'after_publish_next_month'
    check (payment_term_type in ('after_publish_next_month', 'after_publish_days', 'fixed_date')),
  add column if not exists payment_term_value int;

comment on column campaigns.payment_term_type is
  '결제 조건 — after_publish_next_month(익월 O일)|after_publish_days(게재 후 O일 이내)|fixed_date(고정일)';
comment on column campaigns.payment_term_value is
  'after_publish_next_month=일(1~31), after_publish_days=일수. fixed_date는 payment_due_date 컬럼을 그대로 사용';
comment on column campaigns.payment_due_date is
  '⚠️ payment_term_type=fixed_date 일 때만 직접입력값. 그 외 타입은 게재 완료 후 규칙으로 자동 산출됨(0040 참고)';
comment on column campaigns.payment_due_rule is
  '선택적 보충 메모(자유 텍스트) — payment_term_type/value가 실제 판정 기준, 이 컬럼은 참고용';

commit;
