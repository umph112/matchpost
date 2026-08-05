-- 0049  블로그 평가 이력 테이블 2종 (IMPLEMENT-3-SCREENS.md 10장 ⑤⑥)
--
-- blog_analytics(0015)는 유저당 1행만 유지하는 최신 스냅샷 upsert 테이블이라 이력이 안 남는다.
-- blog_score_history(0033)가 있지만 influencer_id→profiles 참조 + score/grade/score_version만
-- 있어 문서가 요구하는 세부 지표 스냅샷과 컬럼이 안 맞고, 어디서도 안 쓰이는 죽은 테이블이라
-- 건드리지 않고 문서 스펙대로 별도 테이블을 새로 만든다.
--
-- 쓰기는 scripts/blog_analyzer.py(service-role)만 — blog_analytics(0015)와 같은 패턴으로
-- RLS는 켜두되 공개 조회만 허용한다.

begin;

create table if not exists blog_analytics_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  crawled_on date not null,
  blog_grade text,
  grade_score int,
  visitor_total bigint,
  visitor_daily int,
  neighbor_count int,
  post_count int,
  post_frequency numeric,
  exposure_rate numeric,
  avg_rank numeric,
  missing_metrics int,
  unique (user_id, crawled_on)
);

create index if not exists blog_analytics_history_user_idx
  on blog_analytics_history(user_id, crawled_on desc);

alter table blog_analytics_history enable row level security;

drop policy if exists "blog_analytics_history_select" on blog_analytics_history;
create policy "blog_analytics_history_select" on blog_analytics_history
  for select using (true);


create table if not exists blog_post_rankings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  log_no text not null,
  published_on date not null,
  checked_on date not null,
  title text,
  keywords jsonb,
  exposure_rate numeric,
  avg_rank numeric,
  unique (user_id, log_no, checked_on)
);

create index if not exists blog_post_rankings_user_idx
  on blog_post_rankings(user_id, checked_on desc);

alter table blog_post_rankings enable row level security;

drop policy if exists "blog_post_rankings_select" on blog_post_rankings;
create policy "blog_post_rankings_select" on blog_post_rankings
  for select using (true);


-- blog_analytics에도 결측 항목 수 + 원점수 저장(문서 ④, ⑩ — "N점 · 다음 등급까지 M점" 화면용)
alter table blog_analytics
  add column if not exists missing_metrics int,
  add column if not exists grade_score int;

commit;
