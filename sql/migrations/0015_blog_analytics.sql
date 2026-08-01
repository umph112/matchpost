-- 0015  블로그 분석 데이터 테이블
-- Python 크롤러가 주기적으로 수집 → 여기에 저장
-- 광고주는 인플루언서 프로필에서 조회 가능

create table if not exists blog_analytics (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  blog_url        text not null,
  blog_id         text,             -- 네이버 블로그 ID (URL에서 추출)
  neighbor_count  int,              -- 이웃/팬 수
  visitor_today   int,              -- 오늘 방문자 (공개 설정 시만)
  visitor_total   int,              -- 전체 방문자 (공개 설정 시만)
  post_count      int,              -- 총 글 수
  avg_likes       numeric(6,1),     -- 최근 10개 포스트 평균 공감
  avg_comments    numeric(6,1),     -- 최근 10개 포스트 평균 댓글
  last_post_date  date,             -- 최근 포스팅 날짜
  post_frequency  numeric(5,1),     -- 월 평균 포스팅 수 (최근 3개월)
  crawled_at      timestamptz default now(),
  error_message   text,             -- 크롤링 실패 메시지
  unique (user_id)
);

-- RLS: 누구나 조회 가능 (공개 지표), INSERT/UPDATE는 service_role(크롤러)만
alter table blog_analytics enable row level security;

drop policy if exists "blog_analytics_select" on blog_analytics;
create policy "blog_analytics_select" on blog_analytics
  for select using (true);
