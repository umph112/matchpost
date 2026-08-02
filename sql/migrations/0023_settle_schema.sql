-- 0023  settleCampaign 스키마 (IMPLEMENT-2 기반)
-- proposals에 정산 컬럼 추가, deal_checkpoints(proposal_id 기반),
-- reviews/notifications 컬럼 보강, notification_schedules, contact_reveal_log,
-- trust_score VIEW — deals 테이블 없음, proposals가 딜 엔티티

begin;

-- ── 1. proposals 정산 컬럼 ──────────────────────────────────────────
alter table proposals
  add column if not exists settled_at                timestamptz,
  add column if not exists settled_backdated_reason  text,
  add column if not exists payment_due_date          date,
  add column if not exists payment_due_date_original date,
  add column if not exists withholding_applied       bool,
  add column if not exists amount_gross              int,
  add column if not exists amount_withheld           int,
  add column if not exists amount_net                int,
  add column if not exists contact_hidden_at         timestamptz;

-- settled_at 불변 트리거: 한 번 기록되면 수정 불가
create or replace function trg_fn_proposals_settled_immutable()
returns trigger language plpgsql as $$
begin
  if old.settled_at is not null and new.settled_at is distinct from old.settled_at then
    raise exception 'proposals.settled_at is immutable once set' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_proposals_settled_immutable on proposals;
create trigger trg_proposals_settled_immutable
  before update on proposals
  for each row execute function trg_fn_proposals_settled_immutable();


-- ── 2. deal_checkpoints ─────────────────────────────────────────────
create table if not exists deal_checkpoints (
  id           uuid primary key default gen_random_uuid(),
  proposal_id  uuid not null references proposals(id) on delete cascade,
  kind         text not null check (kind in ('guide','draft','publish','payment')),
  responsible  text not null check (responsible in ('advertiser','influencer')),
  due_original date,
  due_adjusted date,
  completed_at timestamptz,
  late_days    int not null default 0,
  created_at   timestamptz not null default now(),
  unique (proposal_id, kind)
);

create index if not exists deal_checkpoints_proposal_idx on deal_checkpoints(proposal_id);

alter table deal_checkpoints enable row level security;

drop policy if exists "checkpoints_via_proposal" on deal_checkpoints;
create policy "checkpoints_via_proposal" on deal_checkpoints
  for select using (
    exists (
      select 1 from proposals p
      where p.id = proposal_id
        and (auth.uid() = p.advertiser_id or auth.uid() = p.influencer_id)
    )
  );


-- ── 3. reviews 컬럼 추가 ────────────────────────────────────────────
-- is_imputed: 기간 내 미제출 시 시스템이 중립 점수로 대체한 행 표시
-- submitted_at: 실제 제출 시각 (created_at과 다를 수 있음)
alter table reviews
  add column if not exists is_imputed   bool not null default false,
  add column if not exists submitted_at timestamptz;


-- ── 4. notifications 컬럼 추가 (기존 데이터 유지) ───────────────────
alter table notifications
  add column if not exists kind               text,
  add column if not exists ref_type           text,
  add column if not exists ref_id             uuid,
  add column if not exists state              text not null default 'unread',
  add column if not exists notification_group text,
  add column if not exists read_at            timestamptz,
  add column if not exists done_at            timestamptz;


-- ── 5. notification_schedules ───────────────────────────────────────
-- 배치/크론이 send_at >= now()인 미발송 행을 처리한다.
-- notification_group의 done_at이 채워지면 그룹 내 미발송 행을 cancelled_at으로 취소.
create table if not exists notification_schedules (
  id                  uuid primary key default gen_random_uuid(),
  notification_group  text,
  user_id             uuid not null references auth.users(id),
  ref_type            text,
  ref_id              uuid,
  kind                text not null,
  title               text,
  body                text,
  link                text,
  send_at             timestamptz not null,
  sent_at             timestamptz,
  cancelled_at        timestamptz,
  created_at          timestamptz not null default now()
);

create index if not exists notif_schedules_pending_idx
  on notification_schedules(send_at)
  where sent_at is null and cancelled_at is null;

alter table notification_schedules enable row level security;
-- service_role 배치 전용 — 일반 유저 직접 접근 없음


-- ── 6. contact_reveal_log ───────────────────────────────────────────
create table if not exists contact_reveal_log (
  id          uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references proposals(id) on delete cascade,
  viewer_id   uuid not null references auth.users(id),
  viewed_at   timestamptz not null default now()
);

alter table contact_reveal_log enable row level security;

drop policy if exists "contact_log_own_select" on contact_reveal_log;
create policy "contact_log_own_select" on contact_reveal_log
  for select using (auth.uid() = viewer_id);


-- ── 7. trust_score VIEW (12개월 롤링) ──────────────────────────────
-- reviewer_role='advertiser' → reviewee가 influencer 역할로 평가받음 (반대도 동일)
drop view if exists trust_score;

create view trust_score as
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

commit;
