-- 0004  캠페인: 결제 예정일 + 결제방식
-- 관련: src/app/(dashboard)/advertiser/campaigns/new/page.tsx

alter table campaigns
  add column if not exists payment_due_date date,                    -- 결제 예정일(달력 지정)
  add column if not exists payment_due_rule text,                    -- 결제 규칙 직접입력(예: 원고 업로드 익월 10일)
  add column if not exists payment_methods  text[] default '{}';     -- ['세금계산서 발행','3.3% 소득세 신고'] 복수 시 대시에서 최종 결정
