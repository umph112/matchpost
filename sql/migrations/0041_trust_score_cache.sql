-- 0041  trust_score를 VIEW에서 캐시 TABLE로 전환 + 배치 갱신 함수
-- 사용자 지시: "trust_score는 실시간 계산 대신 집계 캐시 + 배치 갱신".
-- 0023의 VIEW를 대체한다 — 프런트에서 trust_score를 직접 읽는 곳은 없음(match_score/review_count만
-- 사용 중, 확인 완료)이라 화면 영향 없음. refresh_trust_score()는 0042의 배치 라우트가 호출한다.

begin;

drop view if exists trust_score;

create table trust_score (
  user_id             uuid not null references auth.users(id),
  role                text not null check (role in ('advertiser', 'influencer')),
  window_months       int not null default 12,
  checkpoints_total   int not null default 0,
  checkpoints_on_time int not null default 0,
  on_time_rate        numeric,
  deals_count         int not null default 0,
  avg_stars           numeric,
  review_count        int not null default 0,
  stars_visible       boolean not null default false,
  top_tags            text[] not null default '{}',
  updated_at          timestamptz not null default now(),
  primary key (user_id, role)
);

alter table trust_score enable row level security;

drop policy if exists "trust_score_select_own" on trust_score;
create policy "trust_score_select_own" on trust_score
  for select using (
    auth.uid() = user_id
    or exists (select 1 from profiles where id = auth.uid() and is_admin = true)
  );
-- insert/update/delete 정책 없음 — refresh_trust_score()(security definer)만 갱신


create or replace function refresh_trust_score()
returns void
language plpgsql
security definer
as $$
begin
  create temporary table _trust_score_computed on commit drop as
  with ws as (
    select now() - interval '12 months' as cutoff
  ),
  user_roles as (
    select distinct advertiser_id as user_id, 'advertiser'::text as role
    from proposals where settled_at is not null
    union
    select distinct influencer_id, 'influencer'
    from proposals where settled_at is not null
  ),
  cp_stats as (
    select
      case dc.responsible
        when 'advertiser' then p.advertiser_id
        when 'influencer' then p.influencer_id
      end as user_id,
      dc.responsible as role,
      count(*) as total,
      count(*) filter (where dc.late_days = 0) as on_time
    from deal_checkpoints dc
    join proposals p on p.id = dc.proposal_id
    cross join ws
    where dc.completed_at >= ws.cutoff
    group by 1, 2
  ),
  deal_cnt as (
    select advertiser_id as user_id, 'advertiser'::text as role, count(*) as deals_count
    from proposals where settled_at is not null
    group by 1, 2
    union all
    select influencer_id, 'influencer', count(*)
    from proposals where settled_at is not null
    group by 1, 2
  ),
  rv_stats as (
    select
      r.reviewee_id as user_id,
      case r.reviewer_role when 'advertiser' then 'influencer' else 'advertiser' end as role,
      count(*) filter (where not r.is_imputed) as review_count,
      avg(r.rating) filter (where not r.is_imputed) as avg_stars
    from reviews r
    cross join ws
    where coalesce(r.submitted_at, r.created_at) >= ws.cutoff
    group by 1, 2
  ),
  tag_flat as (
    select
      r.reviewee_id as user_id,
      case r.reviewer_role when 'advertiser' then 'influencer' else 'advertiser' end as role,
      t.tag
    from reviews r
    cross join unnest(r.tags) as t(tag)
    cross join ws
    where coalesce(r.submitted_at, r.created_at) >= ws.cutoff and not r.is_imputed
  ),
  tag_counted as (
    select user_id, role, tag, count(*) as cnt
    from tag_flat
    group by 1, 2, 3
    having count(*) >= 3
  ),
  top_tags as (
    select user_id, role, array_agg(tag order by cnt desc) as top_tags
    from tag_counted
    group by 1, 2
  )
  select
    ur.user_id,
    ur.role,
    12 as window_months,
    coalesce(cp.total, 0) as checkpoints_total,
    coalesce(cp.on_time, 0) as checkpoints_on_time,
    case when coalesce(cp.total, 0) >= 3
         then round(coalesce(cp.on_time, 0)::numeric / nullif(cp.total, 0), 3)
    end as on_time_rate,
    coalesce(dc.deals_count, 0) as deals_count,
    case when coalesce(rv.review_count, 0) >= 5
         then round(rv.avg_stars::numeric, 1)
    end as avg_stars,
    coalesce(rv.review_count, 0) as review_count,
    coalesce(rv.review_count, 0) >= 5 as stars_visible,
    coalesce(tt.top_tags, '{}') as top_tags
  from user_roles ur
  left join cp_stats cp on cp.user_id = ur.user_id and cp.role = ur.role
  left join deal_cnt dc on dc.user_id = ur.user_id and dc.role = ur.role
  left join rv_stats rv on rv.user_id = ur.user_id and rv.role = ur.role
  left join top_tags tt on tt.user_id = ur.user_id and tt.role = ur.role;

  delete from trust_score ts
  where not exists (
    select 1 from _trust_score_computed c where c.user_id = ts.user_id and c.role = ts.role
  );

  insert into trust_score (
    user_id, role, window_months, checkpoints_total, checkpoints_on_time,
    on_time_rate, deals_count, avg_stars, review_count, stars_visible, top_tags, updated_at
  )
  select
    user_id, role, window_months, checkpoints_total, checkpoints_on_time,
    on_time_rate, deals_count, avg_stars, review_count, stars_visible, top_tags, now()
  from _trust_score_computed
  on conflict (user_id, role) do update set
    window_months       = excluded.window_months,
    checkpoints_total    = excluded.checkpoints_total,
    checkpoints_on_time  = excluded.checkpoints_on_time,
    on_time_rate         = excluded.on_time_rate,
    deals_count          = excluded.deals_count,
    avg_stars            = excluded.avg_stars,
    review_count         = excluded.review_count,
    stars_visible        = excluded.stars_visible,
    top_tags             = excluded.top_tags,
    updated_at           = excluded.updated_at;

  drop table _trust_score_computed;
end;
$$;

commit;
