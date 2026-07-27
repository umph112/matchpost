-- 0005  캠페인: 참여 인플루언서 모집일정 (캠페인 진행 날짜와 별개)
-- 관련: src/app/(dashboard)/advertiser/campaigns/new/page.tsx
-- 참고: 콘텐츠 등록기간(content_start~end)이 원고 마감일을 대체 → manuscript_deadline* 컬럼은 미사용(유지만)

alter table campaigns
  add column if not exists recruit_start  date,   -- 캠페인 신청기간 시작
  add column if not exists recruit_end    date,   -- 캠페인 신청기간 종료
  add column if not exists announce_date  date,   -- 인플루언서 발표
  add column if not exists content_start  date,   -- 콘텐츠 등록기간 시작
  add column if not exists content_end    date,   -- 콘텐츠 등록기간 종료
  add column if not exists recruit_target int;     -- 모집 인원(목표). 표시: 참여 N/target 명
