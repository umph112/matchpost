-- 0087  인플루언서 직접 입금 확인 — D19 PROMPT-6
--
-- 광고주가 정산을 기록하지 않아 미수로 남은 건을, 돈을 받은 인플루언서가 직접 닫는 경로.
-- settle_campaign(0086)은 광고주가 "캠페인 단위"로 기록하는 경로라 재사용하지 않는다.
-- 인플루언서는 자기 proposal 하나만 닫으므로 별도 함수로 만든다.
--
-- 완료 처리 시 부수효과는 settle_campaign(0086)과 동일하게 맞춘다(PROMPT-7 ①):
--   · deal_complete 크레딧 +3,000 양쪽(제안당 1회)
--   · 평가 요청 즉시 알림 + D+3·D+7 예약 양쪽
-- 다른 점(PROMPT-7 ③): 광고주에게 "인플루언서가 직접 확인했다"는 별도 알림.
--
-- 기록자(누가 닫았나)는 0086의 스키마를 따라 campaigns.settled_by 에 남긴다
-- (proposals 에는 settled_by 컬럼이 없다 — 0086이 캠페인 grain 으로 확정).
-- ⚠️ 기존 마이그레이션은 수정하지 않는다.

begin;

create or replace function confirm_payment_by_influencer(
  p_proposal_id uuid,
  p_by_id       uuid,
  p_paid_on     date
)
returns void
language plpgsql
security definer
as $$
declare
  v          proposals%rowtype;
  v_now      timestamptz := now();
  v_paid     timestamptz := (p_paid_on::timestamp) at time zone 'Asia/Seoul';
  v_inf_name text;
begin
  -- 동시 처리 방지: 행 잠금
  select * into v from proposals where id = p_proposal_id for update;
  if not found then
    raise exception 'proposal not found' using errcode = 'P0002';
  end if;

  -- 돈을 받은 본인만 닫을 수 있다 — 그 proposal 의 인플루언서 && 호출자 == 본인
  if v.influencer_id is distinct from p_by_id then
    raise exception 'not your proposal' using errcode = 'P0001';
  end if;
  if auth.uid() is distinct from p_by_id then
    raise exception 'caller mismatch' using errcode = 'P0001';
  end if;

  -- 이미 확인된 건이면 예외(중복 방지)
  if v.paid_confirmed_at is not null then
    raise exception 'already confirmed' using errcode = 'P0003';
  end if;

  -- ── 1. proposals — 입금 확인 + 완료 처리 ────────────────────────────
  --  settled_at 이 비어 있으면(광고주가 안 눌렀을 때) 입금일로 채운다.
  --  이미 있으면(광고주가 기록) 0023 불변 트리거에 걸리지 않게 그대로 둔다(coalesce).
  update proposals set
    paid_confirmed_at = v_paid,
    settlement_status = '완료',
    settled_at        = coalesce(settled_at, v_paid)
  where id = p_proposal_id;

  -- ── 1-1. 기록자 남김 — 인플루언서가 직접 닫았음(campaigns.settled_by = 인플루언서) ──
  update campaigns set settled_by = p_by_id where id = v.campaign_id;

  -- ── 2. deal_complete 크레딧 +3,000 (양쪽, 제안당 1회) — 0086과 동일 ──
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

  -- ── 3. 평가 요청 즉시 알림 + D+3·D+7 예약 (양쪽) — 0086과 동일 ──
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

  -- ── 4. 광고주 알림 — 인플루언서가 직접 확인했음을 구분해 알린다(PROMPT-7 ③) ──
  select name into v_inf_name from profiles where id = v.influencer_id;
  insert into notifications
    (user_id, type, kind, title, body, link, ref_type, ref_id, state)
  values (
    v.advertiser_id, 'payment_confirmed', 'payment_confirmed',
    '정산이 완료로 기록되었습니다',
    coalesce(v_inf_name, '인플루언서') || '님이 입금을 직접 확인했어요 — 정산이 완료로 기록되었습니다.',
    '/advertiser/settlements', 'proposal', p_proposal_id, 'unread'
  );

  -- ── 5. 지연 알림(0071)은 settlement_status='완료'가 되어 자동으로 멈춘다 ──
end;
$$;

-- 인플루언서가 클라이언트에서 직접 호출한다(기존 paid_confirm 경로와 같은 성격).
-- 내부에서 auth.uid() == 본인 && 본인 proposal 을 검증하므로 authenticated 에 부여한다.
revoke execute on function confirm_payment_by_influencer(uuid, uuid, date) from public;
revoke execute on function confirm_payment_by_influencer(uuid, uuid, date) from anon;
grant  execute on function confirm_payment_by_influencer(uuid, uuid, date) to authenticated;

commit;
