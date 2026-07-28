-- 0007  캠페인: 채널별 미션(세부 요구조건)
-- 관련: src/app/(dashboard)/advertiser/campaigns/new/page.tsx

alter table campaigns
  add column if not exists missions jsonb default '{}';
  -- 예: { "블로그": { "글자수": 100, "사진": 5, "지도삽입": true }, "인스타그램": { "해시태그": "#협찬" } }
