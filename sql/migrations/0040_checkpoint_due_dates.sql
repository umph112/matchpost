-- 0040  체크포인트 마감일 채우기 + 결제 예정일 규칙→실제 날짜 산출
-- IMPLEMENT-1-SCHEMA.md §2·§3. 지금까지 deal_checkpoints.due_original/due_adjusted는
-- 생성 시 항상 NULL이라 DeadlineChip이 한 번도 렌더된 적이 없었다(확인 완료).
--
-- 매핑(스키마에 원고/게재 별도 마감 필드가 없어 콘텐츠 등록기간으로 통일 — 문서보다 단순화):
--   guide(광고주 책임)   = campaigns.content_start
--   draft(인플루언서 책임) = campaigns.content_end
--   publish(인플루언서 책임) = campaigns.content_end
--   payment(광고주 책임)  = resolve_payment_due_date(campaigns.payment_term_type/value, content_end)
--
-- "게재 완료 시점에 규칙→실제 날짜 자동 확정"은 이 코드베이스에 별도 "게재 완료" UI/플로우가 없어
-- (publish 체크포인트를 완료 처리하는 코드가 어디에도 없음, 확인 완료) settle_campaign()의
-- 정산 시점을 유일한 실제 완료 이벤트로 근사 사용해 proposals.payment_due_date를 백필한다.

begin;

-- ── 1. resolve_payment_due_date ─────────────────────────────────────
create or replace function resolve_payment_due_date(
  p_term_type   text,
  p_term_value  int,
  p_base        date,
  p_fixed_date  date default null
) returns date
language plpgsql
immutable
as $$
declare
  v_next_month_start date;
  v_days_in_month    int;
  v_day               int;
begin
  if p_term_type = 'fixed_date' then
    return coalesce(p_fixed_date, p_base);
  end if;

  if p_base is null then
    return null;
  end if;

  if p_term_type = 'after_publish_days' then
    return p_base + coalesce(p_term_value, 0);
  end if;

  -- default: after_publish_next_month — 익월 N일 (달의 마지막 날로 클램프)
  v_next_month_start := (date_trunc('month', p_base) + interval '1 month')::date;
  v_days_in_month := extract(day from (v_next_month_start + interval '1 month' - interval '1 day'))::int;
  v_day := least(greatest(coalesce(p_term_value, 1), 1), v_days_in_month);
  return v_next_month_start + (v_day - 1);
end;
$$;


-- ── 2. trg_fn_create_checkpoints 교체 — campaigns 조인해 due_original/due_adjusted 채움 ──
create or replace function trg_fn_create_checkpoints()
returns trigger language plpgsql security definer as $$
declare
  v_campaign     campaigns%rowtype;
  v_guide_due    date;
  v_draft_due    date;
  v_publish_due  date;
  v_payment_due  date;
begin
  if new.advertiser_confirmed = true and new.influencer_confirmed = true
     and (
       coalesce(old.advertiser_confirmed, false) = false
       or coalesce(old.influencer_confirmed, false) = false
     )
  then
    select * into v_campaign from campaigns where id = new.campaign_id;

    if found then
      v_guide_due   := v_campaign.content_start;
      v_draft_due   := v_campaign.content_end;
      v_publish_due := v_campaign.content_end;
      v_payment_due := resolve_payment_due_date(
        v_campaign.payment_term_type,
        v_campaign.payment_term_value,
        v_campaign.content_end,
        v_campaign.payment_due_date
      );
    end if;

    insert into deal_checkpoints (proposal_id, kind, responsible, due_original, due_adjusted)
    values
      (new.id, 'guide',   'advertiser', v_guide_due,   v_guide_due),
      (new.id, 'draft',   'influencer', v_draft_due,   v_draft_due),
      (new.id, 'publish', 'influencer', v_publish_due, v_publish_due),
      (new.id, 'payment', 'advertiser', v_payment_due, v_payment_due)
    on conflict (proposal_id, kind) do nothing;
  end if;
  return new;
end;
$$;


-- ── 3. settle_campaign 교체 — proposals.payment_due_date 백필 단계 추가 ─────
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
  v_payment_due date;
begin
  select * into v from proposals where id = p_proposal_id for update;
  if not found then
    raise exception 'proposal not found' using errcode = 'P0002';
  end if;
  if v.settled_at is not null then
    raise exception 'already settled' using errcode = 'P0003';
  end if;

  -- payment_due_date가 아직 없으면 payment 체크포인트의 due_adjusted로 백필
  -- (규칙→실제 날짜 확정을 대신할 별도 "게재 완료" 이벤트가 없어 정산 시점을 그 근사치로 사용)
  if v.payment_due_date is null then
    select due_adjusted into v_payment_due
    from deal_checkpoints
    where proposal_id = p_proposal_id and kind = 'payment';

    if v.payment_due_date_original is null and v_payment_due is not null then
      update proposals set payment_due_date_original = v_payment_due where id = p_proposal_id;
    end if;
  else
    v_payment_due := v.payment_due_date;
  end if;

  update proposals set
    settled_at               = v_now,
    contact_hidden_at        = v_now + interval '5 days',
    settled_backdated_reason = p_backdated_reason,
    withholding_applied      = p_withholding,
    amount_gross              = p_amount_gross,
    amount_withheld           = p_amount_withheld,
    amount_net                = p_amount_net,
    payment_due_date          = coalesce(payment_due_date, v_payment_due)
  where id = p_proposal_id;

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
end;
$$;

commit;
