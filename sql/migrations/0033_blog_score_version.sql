-- ⑨ 블로그 등급 — 점수 이력 테이블 + 버전 관리
create table if not exists blog_score_history (
  id             uuid primary key default gen_random_uuid(),
  influencer_id  uuid not null references profiles(id) on delete cascade,
  score          numeric(6,2) not null,
  grade          text not null,          -- S, A+, A, B+, B, C+, C, D+, D ...
  score_version  int  not null default 1,
  crawled_on     date not null default current_date,
  created_at     timestamptz not null default now()
);

-- 같은 날 같은 버전 중복 방지
create unique index if not exists blog_score_history_daily
  on blog_score_history (influencer_id, crawled_on, score_version);

-- RLS
alter table blog_score_history enable row level security;

create policy "blog_score_history: read all" on blog_score_history
  for select using (true);
