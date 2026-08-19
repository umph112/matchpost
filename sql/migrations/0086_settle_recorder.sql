-- 0086  정산 기록자(settled_by) — D14 6절
--
-- 6절: 팀원도 회사 정산을 기록할 수 있게 열되(settle.ts 는 이미 회사 단위 권한으로 확장됨),
-- "누가 기록했는지"를 남겨 잘못 기록되었을 때 누구에게 물어야 하는지를 보존한다.
-- settled_at 은 proposals 에 있지만, 한 번의 기록 행위는 캠페인 단위(모달에서 그 캠페인의
-- 확정 제안을 한꺼번에 기록)이므로 기록자는 campaigns 에 남긴다(사용자 확정 스키마).
-- ⚠️ 기존 마이그레이션(0024/0046)은 수정하지 않는다. 여기서 함수를 재정의하고 다시 잠근다.

begin;

alter table campaigns add column if not exists settled_by uuid references profiles(id);
comment on column campaigns.settled_by is
  '이 캠페인의 정산을 마지막으로 기록한 사람(대표 또는 팀원). D14 6절 — 오기록 시 책임 소재.';

-- settle_campaign 에 기록자 인자(p_settled_by) 추가.
-- 6-arg 원본을 드롭하고 7-arg 로 재정의한다(named-arg 시그니처가 바뀌어 create or replace 불가).
drop function if exists settle_campaign(uuid, text, bool, int, int, int);

create or replace function settle_campaign(
  p_proposal_id        uuid,
  p_backdated_reason   text    default null,
  p_withholding        bool    default null,
  p_amount_gross       int     default null,
  p_amount_withheld    int     default null,
  p_amount_net         int     default null,
  p_settled_by         uuid    default null
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

  -- ── 1-1. 기록자 남김 (D14 6절) ──────────────────────────────────────
  -- 한 번의 기록 행위 단위 = 캠페인. 마지막 기록자를 캠페인에 남긴다.
  update campaigns set settled_by = p_settled_by where id = v.campaign_id;

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

-- 0046 과 동일하게 service_role 전용으로 다시 잠근다(시그니처가 바뀌었으므로 재부여 필요).
revoke execute on function settle_campaign(uuid, text, bool, int, int, int, uuid) from public;
revoke execute on function settle_campaign(uuid, text, bool, int, int, int, uuid) from anon;
revoke execute on function settle_campaign(uuid, text, bool, int, int, int, uuid) from authenticated;
grant  execute on function settle_campaign(uuid, text, bool, int, int, int, uuid) to service_role;

commit;
