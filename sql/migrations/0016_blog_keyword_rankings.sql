-- 0016  블로그 키워드 검색 노출 순위 컬럼 추가
-- 네이버 블로그 검색 API로 카테고리 키워드별 상위 노출 여부 확인

alter table blog_analytics
  add column if not exists keyword_rankings jsonb,     -- [{keyword, found, rank, post_title}, ...]
  add column if not exists top10_count     int default 0,  -- 상위 10위 내 노출 키워드 수
  add column if not exists top30_count     int default 0;  -- 상위 30위 내 노출 키워드 수
