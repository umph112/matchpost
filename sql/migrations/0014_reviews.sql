-- 0014  협업 리뷰 + 매치 스코어
-- 블라인드 방식: 양쪽 제출 후 동시 공개 (is_revealed = true)
-- 매치 스코어: 인플루언서가 광고주에게 받은 리뷰 기반, 0~100점

-- ── 인플루언서 매치 스코어 컬럼 ─────────────────────────────────
alter table influencer_profiles
  add column if not exists match_score int,           -- null = 리뷰 없음(신규)
  add column if not exists review_count int default 0;

-- ── 리뷰 테이블 ──────────────────────────────────────────────────
create table if not exists reviews (
  id            uuid primary key default gen_random_uuid(),
  proposal_id   uuid not null references proposals(id) on delete cascade,
  reviewer_id   uuid not null references auth.users(id),
  reviewee_id   uuid not null references auth.users(id),
  reviewer_role text not null check (reviewer_role in ('advertiser', 'influencer')),
  rating        int  not null check (rating between 1 and 5),
  tags          text[] default '{}',
  comment       text,
  is_revealed   boolean not null default false,
  created_at    timestamptz default now(),
  unique (proposal_id, reviewer_id)
);

-- RLS: 본인이 쓴 리뷰 or 공개된 리뷰만 읽기 가능
alter table reviews enable row level security;

drop policy if exists "reviews_select" on reviews;
create policy "reviews_select" on reviews
  for select using (
    auth.uid() = reviewer_id
    or (is_revealed = true and auth.uid() = reviewee_id)
  );

drop policy if exists "reviews_insert" on reviews;
create policy "reviews_insert" on reviews
  for insert with check (auth.uid() = reviewer_id);

-- ── 블라인드 공개 트리거 ──────────────────────────────────────────
-- 양쪽 다 제출되면 두 리뷰 모두 is_revealed = true
create or replace function trg_fn_reveal_reviews()
returns trigger language plpgsql security definer as $$
declare
  other_exists boolean;
begin
  select exists(
    select 1 from reviews
    where proposal_id = new.proposal_id
      and reviewer_id <> new.reviewer_id
  ) into other_exists;

  if other_exists then
    update reviews
    set is_revealed = true
    where proposal_id = new.proposal_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_reveal_reviews on reviews;
create trigger trg_reveal_reviews
after insert on reviews
for each row execute function trg_fn_reveal_reviews();

-- ── 매치 스코어 갱신 트리거 ───────────────────────────────────────
-- 리뷰 공개(is_revealed=true) 시 인플루언서 match_score 재계산
-- 공식: (avg_rating - 1) / 4 * 100 → 1점=0, 3점=50, 5점=100
create or replace function trg_fn_update_match_score()
returns trigger language plpgsql security definer as $$
declare
  v_influencer_id uuid;
  v_avg float;
  v_cnt int;
begin
  -- 광고주가 인플루언서에게 쓴 공개 리뷰만 집계
  -- reviewee_id = 인플루언서 user_id, reviewer_role = 'advertiser'
  select
    avg(rating)::float,
    count(*)::int
  into v_avg, v_cnt
  from reviews
  where reviewee_id = new.reviewee_id
    and reviewer_role = 'advertiser'
    and is_revealed = true;

  update influencer_profiles
  set
    match_score  = round(((v_avg - 1.0) / 4.0) * 100)::int,
    review_count = v_cnt
  where user_id = new.reviewee_id;

  return new;
end;
$$;

drop trigger if exists trg_update_match_score on reviews;
create trigger trg_update_match_score
after update of is_revealed on reviews
for each row
when (new.is_revealed = true and new.reviewer_role = 'advertiser')
execute function trg_fn_update_match_score();
