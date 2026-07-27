-- 0006  캠페인: 장소 상세(장소명·주소) — 지역 캠페인 방문 주소
-- 관련: src/app/(dashboard)/advertiser/campaigns/new/page.tsx, src/app/api/search-place/route.ts

alter table campaigns
  add column if not exists location_name    text,   -- 장소명 (예: 스타벅스 강남점)
  add column if not exists location_address text;    -- 상세 주소 (네이버 지역검색 도로명/지번)

-- location_city/location_district는 기존 컬럼 유지(표시·달력용, 검색 시 자동 파생)
