-- 0097 — 방문 시각 로그 (D30 [1])
--
-- 왜 새 테이블인가:
--   user_visit_log 는 (user_id, visited_on) PK 에 ignoreDuplicates upsert 라
--   「하루 한 사람당 한 행 = 그날 첫 방문」이다. 그것이 「하루 순방문자」의 원본이고
--   리워드 판정(run_visit_weekly_batch 주 5일 · run_visit_monthly_batch 월 20일)이
--   count(distinct visited_on) 으로 그 위에 서 있다.
--   거기에 시각 컬럼을 얹으면 「첫 방문 시각」과 「트래픽 시각」이 한 행에서 싸운다.
--
-- ⚠️ user_visit_log · visited_on · 리워드 배치 두 함수는 이 마이그레이션이 건드리지 않는다.

begin;

-- ── 1. 원본 — 매 페이지 조회마다 한 행 ────────────────────────────
--    upsert 아니라 insert. user_id 는 null 허용(로그아웃 공개 페이지도 센다).
create table if not exists page_views (
  id        bigserial primary key,
  user_id   uuid references profiles(id) on delete set null,
  path      text,
  viewed_at timestamptz not null default now()
);

create index if not exists page_views_at_idx on page_views (viewed_at desc);

alter table page_views enable row level security;

-- 방문 기록은 본인이 볼 것이 아니다. 관리자만 읽고, 쓰기는 service 로만.
-- (insert 정책을 두지 않으므로 anon·authenticated 는 쓸 수 없다.)
drop policy if exists "page_views_select_admin" on page_views;
create policy "page_views_select_admin" on page_views
  for select using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );


-- ── 2. 집계 — 원본을 90일 뒤 버려도 남는 비교선 ───────────────────
--    시각축과 path 축을 한 테이블에 곱하면 행이 폭증한다. 축을 나눠 둘로 둔다.

-- ② -1 시간대: 하루 24행. bucket 은 date_trunc('hour', viewed_at).
--    KST 가 정확히 +09:00 이라 시 경계가 UTC 와 어긋나지 않는다 —
--    저장은 instant 로 하고 표시만 KST 로 돌린다.
create table if not exists page_view_hourly (
  bucket   timestamptz primary key,
  views    int not null default 0,  -- 조회수(연인원)
  visitors int not null default 0,  -- distinct user_id (로그인 방문자)
  guests   int not null default 0   -- user_id null (로그아웃 조회)
);

-- ② -2 화면별: 하루 (열린 화면 수)행.
create table if not exists page_view_daily_path (
  day   date not null,
  path  text not null,
  views int not null default 0,
  primary key (day, path)
);

alter table page_view_hourly enable row level security;
alter table page_view_daily_path enable row level security;

drop policy if exists "page_view_hourly_select_admin" on page_view_hourly;
create policy "page_view_hourly_select_admin" on page_view_hourly
  for select using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

drop policy if exists "page_view_daily_path_select_admin" on page_view_daily_path;
create policy "page_view_daily_path_select_admin" on page_view_daily_path
  for select using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );


-- ── 3. 롤업 — 집계 먼저, 삭제 나중 ────────────────────────────────
--    ⚠️ 순서가 중요하다. 지우고 나서 집계하면 그 구간이 통째로 빈다.
--
--    남아 있는 원본(=최근 90일)에서 매번 다시 세어 upsert 한다. 두 번 돌려도 값이 안 틀어진다.
--    원본이 지워진 옛 구간은 group by 결과에 아예 안 나오므로 0 으로 덮이지 않는다.
create or replace function run_page_view_rollup(p_keep_days int default 90)
returns table(hours int, paths int, purged int)
language plpgsql
security definer
as $$
declare
  v_hour_end timestamptz := date_trunc('hour', now());                                  -- 진행 중인 시간은 제외
  v_day_end  timestamptz := date_trunc('day', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul';
begin
  with agg as (
    select date_trunc('hour', viewed_at) as bucket,
           count(*)::int                              as views,
           count(distinct user_id)::int               as visitors,
           count(*) filter (where user_id is null)::int as guests
    from page_views
    where viewed_at < v_hour_end
    group by 1
  ), up as (
    insert into page_view_hourly (bucket, views, visitors, guests)
    select bucket, views, visitors, guests from agg
    on conflict (bucket) do update
      set views = excluded.views, visitors = excluded.visitors, guests = excluded.guests
    returning 1
  )
  select count(*)::int into hours from up;

  with agg as (
    select (viewed_at at time zone 'Asia/Seoul')::date as day,
           coalesce(path, '/')                        as path,
           count(*)::int                              as views
    from page_views
    where viewed_at < v_day_end
    group by 1, 2
  ), up as (
    insert into page_view_daily_path (day, path, views)
    select day, path, views from agg
    on conflict (day, path) do update set views = excluded.views
    returning 1
  )
  select count(*)::int into paths from up;

  with del as (
    delete from page_views
    where viewed_at < now() - make_interval(days => p_keep_days)
    returning 1
  )
  select count(*)::int into purged from del;

  return next;
end;
$$;

commit;
