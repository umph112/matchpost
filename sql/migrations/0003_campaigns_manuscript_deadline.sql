-- 0003  캠페인: 원고 마감일 + 추가 전달내용
-- 관련: src/app/(dashboard)/advertiser/campaigns/new/page.tsx

alter table campaigns
  add column if not exists manuscript_deadline      date,   -- 원고 마감일
  add column if not exists manuscript_deadline_note  text;   -- 마감일 외 추가 전달내용
