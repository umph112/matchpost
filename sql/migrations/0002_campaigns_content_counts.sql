-- 0002  캠페인: 채널별 의뢰 콘텐츠 수량
-- 관련: src/app/(dashboard)/advertiser/campaigns/new/page.tsx

alter table campaigns
  add column if not exists content_counts jsonb default '{}';  -- { 블로그:1, 유튜브:1, 인스타그램:1, 틱톡:1 } (선택 채널만, 1~99)
