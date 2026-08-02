-- 0024  settle_campaign 함수 + 체크포인트 트리거 2종
--
-- 1. settle_campaign(uuid, ...)  — 정산 6단계를 한 트랜잭션으로
--    SELECT FOR UPDATE로 동시 정산 방지
-- 2. trg_create_checkpoints      — 양쪽 확정 시 4행(guide/draft/publish/payment) 자동 생성
-- 3. trg_checkpoint_cascade_delay — 체크포인트 완료 지연 시 하위 due_adjusted 연쇄 이동

begin;

-- ──────────────────────────────────────────────────────────────────────────────
-- 1. settle_campaign
-- ──────────────────────────────────────────────────────────────────────────────
create or replace function settle_campaign(
  p_proposal_id        uuid,
  p_backdated_reason   text    default null,
  p_withholding        bool    default null,
  p_amount_gross       int     default null,
  p_amount_withheld    int     default null,
  p_amount_net         int     default null
)
returns void
language plpgsql
security definer
as $$
declare
  v   proposals%rowtype;
  cp  deal_checkpoints%rowtype;
  v_now timestamptz := now();
  v_late int;
begin
  -- 동시 정산 방지: 행 잠금
  select * into v from proposals where id = p_proposal_id for update;
  if not found then
    raise exception 'proposal not found' using errcode = 'P0002';
  end if;
  if v.settled_at is not null then
    raise exception 'already settled' using errcode = 'P0003';
  end if;

  -- ── 1. proposals 정산 컬럼 설정 ─────────────────────────────────────
  update proposals set
    settled_at               = v_now,
    contact_hidden_at        = v_now + interval '5 days',
    settled_backdated_reason = p_backdated_reason,
    withholding_applied      = p_withholding,
    amount_gross             = p_amount_gross,
    amount_withheld          = p_amount_withheld,
    amount_net               = p_amount_net
  where id = p_proposal_id;

  -- ── 2. payment 체크포인트 완료 + late_days (유예 3일) ───────────────
  select * into cp
  from deal_checkpoints
  where proposal_id = p_proposal_id and kind = 'payment' and completed_at is null;

  if found then
    v_late := case
      when cp.due_adjusted is not null
        then greatest(0, (v_now::date - cp.due_adjusted) - 3)
      else 0
    end;
    update deal_checkpoints
    set completed_at = v_now, late_days = v_late
    where id = cp.id;
  end if;

  -- ── 3. deal_complete 크레딧 +3,000 (제안당 1회) ─────────────────────
  if not exists (
    select 1 from credit_ledger
    where user_id = v.advertiser_id and ref_id = p_proposal_id
      and ref_type = 'proposal' and reason_code = 'deal_complete'
  ) then
    perform credit_ledger_grant(
      v.advertiser_id, 3000, 'reward', 'deal_complete',
      'proposal', p_proposal_id, '정산 완료 크레딧'
    );
  end if;

  if not exists (
    select 1 from credit_ledger
    where user_id = v.influencer_id and ref_id = p_proposal_id
      and ref_type = 'proposal' and reason_code = 'deal_complete'
  ) then
    perform credit_ledger_grant(
      v.influencer_id, 3000, 'reward', 'deal_complete',
      'proposal', p_proposal_id, '정산 완료 크레딧'
    );
  end if;

  -- ── 4. trust_score — VIEW이므로 no-op ───────────────────────────────

  -- ── 5. 평가 요청 즉시 알림 + D+3·D+7 예약 ──────────────────────────
  -- type: 기존 notifications.type NOT NULL 컬럼 충족
  insert into notifications
    (user_id, type, kind, title, body, link, ref_type, ref_id, state, notification_group)
  values
    (v.advertiser_id, 'review_request', 'review_request',
     '상대방을 평가해주세요', '7일 이내 평가 시 크레딧 1,000C가 지급됩니다.',
     '/advertiser/campaigns', 'proposal', p_proposal_id, 'unread',
     'review:' || p_proposal_id),
    (v.influencer_id, 'review_request', 'review_request',
     '상대방을 평가해주세요', '7일 이내 평가 시 크레딧 1,000C가 지급됩니다.',
     '/advertiser/campaigns', 'proposal', p_proposal_id, 'unread',
     'review:' || p_proposal_id);

  insert into notification_schedules
    (notification_group, user_id, ref_type, ref_id, kind, title, body, link, send_at)
  select
    'review:' || p_proposal_id,
    u.user_id,
    'proposal', p_proposal_id,
    s.kind, s.title, s.body,
    '/advertiser/campaigns',
    v_now + s.delay
  from (values
    (v.advertiser_id),
    (v.influencer_id)
  ) as u(user_id)
  cross join (values
    ('review_reminder',
     '아직 평가를 완료하지 않으셨어요',
     '4일 후 평가 기간이 마감됩니다.',
     interval '3 days'),
    ('review_deadline',
     '오늘이 평가 마감일이에요',
     '오늘 자정까지 평가하지 않으면 크레딧이 지급되지 않아요.',
     interval '7 days')
  ) as s(kind, title, body, delay);

  -- ── 6. contact_hidden_at은 1단계에서 이미 설정됨 ────────────────────
end;
$$;


-- ──────────────────────────────────────────────────────────────────────────────
-- 2. 양쪽 확정 시 체크포인트 4행 자동 생성
--    responsible: guide=광고주, draft=인플루언서, publish=인플루언서, payment=광고주
-- ──────────────────────────────────────────────────────────────────────────────
create or replace function trg_fn_create_checkpoints()
returns trigger language plpgsql security definer as $$
begin
  if new.advertiser_confirmed = true and new.influencer_confirmed = true
     and (
       coalesce(old.advertiser_confirmed, false) = false
       or coalesce(old.influencer_confirmed, false) = false
     )
  then
    insert into deal_checkpoints (proposal_id, kind, responsible)
    values
      (new.id, 'guide',   'advertiser'),
      (new.id, 'draft',   'influencer'),
      (new.id, 'publish', 'influencer'),
      (new.id, 'payment', 'advertiser')
    on conflict (proposal_id, kind) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_create_checkpoints on proposals;
create trigger trg_create_checkpoints
  after update on proposals
  for each row execute function trg_fn_create_checkpoints();


-- ──────────────────────────────────────────────────────────────────────────────
-- 3. 귀책 상계: 체크포인트 완료 지연 시 하위 due_adjusted 연쇄 이동
--    guide 지연 N일 → draft·publish due_adjusted +N일
--    draft 지연 N일 → publish due_adjusted +N일
--    due_original 불변, due_adjusted만 밀림, due_adjusted null 행은 건드리지 않음
-- ──────────────────────────────────────────────────────────────────────────────
create or replace function trg_fn_checkpoint_cascade_delay()
returns trigger language plpgsql as $$
begin
  -- completed_at이 null → not null 으로 바뀐 시점에만 동작
  if old.completed_at is not null or new.completed_at is null then
    return new;
  end if;

  if new.late_days <= 0 then
    return new;
  end if;

  if new.kind = 'guide' then
    update deal_checkpoints
    set due_adjusted = due_adjusted + (new.late_days || ' days')::interval
    where proposal_id = new.proposal_id
      and kind in ('draft', 'publish')
      and due_adjusted is not null;

  elsif new.kind = 'draft' then
    update deal_checkpoints
    set due_adjusted = due_adjusted + (new.late_days || ' days')::interval
    where proposal_id = new.proposal_id
      and kind = 'publish'
      and due_adjusted is not null;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_checkpoint_cascade_delay on deal_checkpoints;
create trigger trg_checkpoint_cascade_delay
  after update on deal_checkpoints
  for each row execute function trg_fn_checkpoint_cascade_delay();

commit;
