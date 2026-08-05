-- 0045  notifications 3단계(unread/read/done) — 누락된 CHECK 제약 + "행위로만 done" 배선
--
-- 범위를 좁힌 이유: guide/draft/publish 체크포인트를 "완료"로 표시하는 액션 자체가
-- 코드 어디에도 없다(payment만 settle_campaign에서 자동 완료). 그 체크포인트에 딸린
-- 알림도 애초에 발행되지 않으므로, 없는 액션에 done 전이를 붙일 수 없다.
-- 대신 실제로 존재하는 두 흐름만 배선한다:
--   1) 평가 제출(reviews insert) → 그 사람의 'review:'||proposal_id 그룹을 done + 예약 취소
--   2) 정산 등록(settle_campaign) → 해당 proposal의 payment_reminder 알림을 done
-- 그룹은 광고주·인플루언서가 같은 notification_group('review:'||id)을 공유하므로,
-- 취소는 반드시 user_id로 좁혀서 상대방 예약까지 취소되지 않게 한다.

begin;

-- ── 1. 누락됐던 CHECK 제약 ───────────────────────────────────────────
alter table notifications
  add constraint notifications_state_check
  check (state in ('unread', 'read', 'done'));

-- ── 2. 평가 제출 시 본인의 review 알림/예약 done 처리 ─────────────────
create or replace function trg_fn_review_submitted_notify_done()
returns trigger language plpgsql security definer as $$
declare
  v_group text := 'review:' || new.proposal_id;
begin
  update notifications
  set state = 'done', done_at = now()
  where user_id = new.rater_id
    and notification_group = v_group
    and state <> 'done';

  update notification_schedules
  set cancelled_at = now()
  where user_id = new.rater_id
    and notification_group = v_group
    and sent_at is null
    and cancelled_at is null;

  return new;
end;
$$;

drop trigger if exists trg_review_submitted_notify_done on reviews;
create trigger trg_review_submitted_notify_done
after insert on reviews
for each row execute function trg_fn_review_submitted_notify_done();

-- ── 3. settle_campaign — payment_reminder 알림 done 처리 추가 ────────
-- 0040의 본문 그대로 + 정산 등록 시 해당 proposal의 payment_reminder를 done으로 전환하는
-- 블록만 추가(그 외 로직 변경 없음).
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

  -- 미수금 알림은 "입금 확인"(정산 등록)이 실제로 들어와야 done — 봤다고 내려가지 않는다
  update notifications
  set state = 'done', done_at = v_now
  where ref_type = 'proposal' and ref_id = p_proposal_id
    and kind = 'payment_reminder' and state <> 'done';

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

-- ── 4. 인덱스 — 위 두 배선이 쓰는 조회 패턴 ───────────────────────────
create index if not exists notifications_group_idx
  on notifications(notification_group);

create index if not exists notification_schedules_group_idx
  on notification_schedules(notification_group, user_id);

create index if not exists credit_ledger_ref_idx
  on credit_ledger(ref_type, ref_id, reason_code);

commit;
