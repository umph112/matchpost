-- ⑨ 블로그 등급 — 점수 버전 관리
-- score_version: 채점 로직이 바뀌어도 이전 점수와 구분 가능
alter table blog_score_history
  add column if not exists score_version int not null default 1;

-- crawled_on: 배치 실행일로 고정 (당일 여러 번 크롤해도 같은 날짜)
alter table blog_score_history
  add column if not exists crawled_on date not null default current_date;

-- 같은 날 같은 버전 중복 방지
create unique index if not exists blog_score_history_daily
  on blog_score_history (influencer_id, crawled_on, score_version);
