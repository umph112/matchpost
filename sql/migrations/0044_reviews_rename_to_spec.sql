-- 0044  reviews 컬럼명을 IMPLEMENT-2-SETTLE.md 스펙에 맞춤 + closed_at 추가
-- reviewer_id→rater_id, reviewee_id→ratee_id, reviewer_role→role, rating→stars, comment→private_note
-- RLS 정책·CHECK 제약·UNIQUE 제약은 Postgres가 컬럼 rename에 맞춰 자동으로 따라감(재작성 불필요).
-- 트리거 "함수 본문"은 텍스트라 자동으로 안 따라가므로 아래에서 재정의한다.
-- closed_at: 문서 스키마에는 있으나 언제 채우는지 정의가 없어 컬럼만 추가(로직 없음).

begin;

alter table reviews rename column reviewer_id to rater_id;
alter table reviews rename column reviewee_id to ratee_id;
alter table reviews rename column reviewer_role to role;
alter table reviews rename column rating to stars;
alter table reviews rename column comment to private_note;

alter table reviews
  add column if not exists closed_at timestamptz;

-- ── 블라인드 공개 트리거 (0014, 컬럼명만 갱신) ──────────────────────
create or replace function trg_fn_reveal_reviews()
returns trigger language plpgsql security definer as $$
declare
  other_exists boolean;
begin
  select exists(
    select 1 from reviews
    where proposal_id = new.proposal_id
      and rater_id <> new.rater_id
  ) into other_exists;

  if other_exists then
    update reviews
    set is_revealed = true
    where proposal_id = new.proposal_id;
  end if;
  return new;
end;
$$;

-- ── 매치 스코어 갱신 트리거 (0014, 컬럼명만 갱신) ────────────────────
create or replace function trg_fn_update_match_score()
returns trigger language plpgsql security definer as $$
declare
  v_avg float;
  v_cnt int;
begin
  select
    avg(stars)::float,
    count(*)::int
  into v_avg, v_cnt
  from reviews
  where ratee_id = new.ratee_id
    and role = 'advertiser'
    and is_revealed = true;

  update influencer_profiles
  set
    match_score  = round(((v_avg - 1.0) / 4.0) * 100)::int,
    review_count = v_cnt
  where user_id = new.ratee_id;

  return new;
end;
$$;

drop trigger if exists trg_update_match_score on reviews;
create trigger trg_update_match_score
after update of is_revealed on reviews
for each row
when (new.is_revealed = true and new.role = 'advertiser')
execute function trg_fn_update_match_score();

-- ── refresh_trust_score() — reviews 참조 부분만 컬럼명 갱신 ──────────
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
      r.ratee_id as user_id,
      case r.role when 'advertiser' then 'influencer' else 'advertiser' end as role,
      count(*) filter (where not r.is_imputed) as review_count,
      avg(r.stars) filter (where not r.is_imputed) as avg_stars
    from reviews r
    cross join ws
    where coalesce(r.submitted_at, r.created_at) >= ws.cutoff
    group by 1, 2
  ),
  tag_flat as (
    select
      r.ratee_id as user_id,
      case r.role when 'advertiser' then 'influencer' else 'advertiser' end as role,
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
