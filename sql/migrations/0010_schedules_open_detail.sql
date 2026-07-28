-- 0010  오픈(schedules) 상세 컬럼 — 캘린더 날짜 팝업의 오픈 상세용
-- 관련: src/app/(dashboard)/advertiser/dashboard/page.tsx (byDay opens), STEP 5 날짜 팝업
-- 기존: start_time/end_time(가능시간), location_city/district(지역), predefined_categories(분야) 존재
-- 추가: 채널 / 희망페이 / 메모 (없으면 팝업에서 해당 항목 미표시)

alter table schedules
  add column if not exists channels text[] default '{}',  -- 희망 채널 (블로그/유튜브/인스타그램/틱톡 등)
  add column if not exists fee      text,                   -- 희망 페이 (예: "30만원~")
  add column if not exists memo     text;                    -- 인플루언서 메모
