-- 0088  결제일 변경 합의 경로 — D20
--
-- D19 §1-3-2 조사만 하고 미뤘던 건. 대화에서 「결제를 9/5로 미루자」고 합의해도
-- 값이 안 바뀌어 8/21부터 미수로 뜨고, 광고주에게 지연 알림이 매일 가고,
-- 그 횟수가 제재 판정 근거로 쌓인다. 합의를 지킨 광고주가 제재 근거를 쌓는 문제.
--
-- 이 파일은 D20 전체를 담는다:
--   §2 스키마 + 지연 알림 배치(run_settlement_reminder_batch) per-proposal 재작성  ← 아래
--   §3 제안(propose_settlement_date) · 수락(accept_date_proposal 분기)            ← §3 작업 시 이 파일에 추가
-- ⚠️ 기존 마이그레이션(0066/0071)은 수정하지 않는다. 기존 행도 건드리지 않는다.
-- add column if not exists / create or replace 라 재실행해도 안전하다.

begin;

-- ── §2. 스키마 ──────────────────────────────────────────────────────────────
alter table proposals add column if not exists settlement_date date;
comment on column proposals.settlement_date is
  '이 사람과 합의한 결제 예정일. 비면 campaigns.settlement_date 를 쓴다. 매출 시점의 원본.';

alter table proposals add column if not exists proposed_date_kind text
  check (proposed_date_kind in ('progress','settlement'));
comment on column proposals.proposed_date_kind is
  '제안 중인 날짜의 종류. progress = 진행일, settlement = 결제일. null 은 기존 데이터(진행일).';

-- Option B — 지연 알림 카운터를 캠페인이 아니라 "사람(proposal)별"로 센다.
-- 한 캠페인 안에서도 합의한 사람은 지연이 아니고, 안 한 사람만 지연으로 쌓여야 하기 때문.
-- campaigns.overdue_reminder_count(0071)은 남겨두되 더 이상 증가시키지 않는다.
alter table proposals add column if not exists overdue_reminder_count int not null default 0;
comment on column proposals.overdue_reminder_count is
  '이 사람 건에 대해 발송된 정산 지연 알림 누적 횟수(제재 판정 근거). 결제일 합의 시 0으로 리셋.';

-- 날짜 카드가 종류를 말할 수 있게 — 카드는 messages 행마다 그려지므로 메시지에 종류를 남긴다.
-- null 은 기존 카드(진행일). send_dash(0066)가 만드는 진행일 카드는 계속 null 이면 된다.
alter table messages add column if not exists proposed_date_kind text
  check (proposed_date_kind in ('progress','settlement'));
comment on column messages.proposed_date_kind is
  '이 날짜 제안 카드의 종류. progress = 진행일, settlement = 결제일. null 은 기존 카드(진행일).';

-- ── §2. 지연 알림 배치 — per-proposal 재작성 ────────────────────────────────
-- 판정 기준을 coalesce(proposals.settlement_date, campaigns.settlement_date) 로 바꾼다(단일 원본).
-- 카운터·시스템 줄은 "미수인 사람(proposal)"마다. 광고주 알림은 캠페인당 1회(중복 방지)로 유지.
-- return 시그니처는 (campaign_id, count) 그대로 두어 호출부(route)를 건드리지 않는다.
create or replace function run_settlement_reminder_batch()
returns table(campaign_id uuid, count int)
language plpgsql
security definer
as $$
declare
  r record;
  v_today date := (now() at time zone 'Asia/Seoul')::date;
begin
  -- 1) 미수인 사람(proposal)마다: 카운터 +1 + 그 대화에 시스템 줄
  for r in
    select p.id as proposal_id, p.campaign_id, p.advertiser_id, p.influencer_id,
           p.overdue_reminder_count as prev_count
    from proposals p
    join campaigns c on c.id = p.campaign_id
    where p.advertiser_confirmed = true and p.influencer_confirmed = true
      and coalesce(p.settlement_status, '미정산') <> '완료'
      and coalesce(p.settlement_date, c.settlement_date) is not null
      and coalesce(p.settlement_date, c.settlement_date) < v_today
  loop
    update proposals set overdue_reminder_count = overdue_reminder_count + 1
    where id = r.proposal_id;

    insert into messages (sender_id, receiver_id, proposal_id, content, is_system)
    values (
      r.advertiser_id, r.influencer_id, r.proposal_id,
      to_char(now() at time zone 'Asia/Seoul', 'MM월 DD일') || ' · 지연 알림 발송 (' || (r.prev_count + 1) || '회)' ||
      case when r.prev_count + 1 >= 3 then ' · 3일째부터 운영팀이 함께 확인합니다' else '' end,
      true
    );

    campaign_id := r.campaign_id; count := r.prev_count + 1;
    return next;
  end loop;

  -- 2) 미수인 사람이 하나라도 있는 캠페인마다: 광고주에게 1회 알림(문구·링크 0071 그대로)
  for r in
    select c.id, c.advertiser_id, c.title
    from campaigns c
    where exists (
      select 1 from proposals p
      where p.campaign_id = c.id
        and p.advertiser_confirmed = true and p.influencer_confirmed = true
        and coalesce(p.settlement_status, '미정산') <> '완료'
        and coalesce(p.settlement_date, c.settlement_date) is not null
        and coalesce(p.settlement_date, c.settlement_date) < v_today
    )
  loop
    insert into notifications (user_id, type, kind, title, body, link, ref_type, ref_id, state)
    values (
      r.advertiser_id, 'settlement_overdue', 'settlement_overdue',
      '정산 예정일이 지났어요',
      r.title || ' — 미수 상태예요. 정산 화면에서 확인해주세요.',
      '/advertiser/settlements', 'campaign', r.id, 'unread'
    );
  end loop;
end;
$$;

revoke execute on function run_settlement_reminder_batch() from public, anon, authenticated;
grant  execute on function run_settlement_reminder_batch() to service_role;

-- ── §3. 제안 · 수락 ─────────────────────────────────────────────────────────
-- 결제일 제안 — 대시 대화창에서. 진행일 제안(send_dash)과 같은 자리·같은 카드,
-- 다만 proposed_date_kind='settlement' 로 종류를 표시한다. start_at(진행일)은 안 건드린다.
-- 링크는 방향별: 인플루언서에게는 딥링크(대화방), 광고주에게는 목록(/advertiser/messages).
create or replace function propose_settlement_date(
  p_proposal_id uuid,
  p_by_id       uuid,
  p_date        date,
  p_reason      text
) returns void
language plpgsql
security definer
as $$
declare
  v_advertiser uuid; v_influencer uuid; v_receiver uuid; v_by_name text;
begin
  select advertiser_id, influencer_id into v_advertiser, v_influencer
  from proposals where id = p_proposal_id;

  if v_advertiser is null then
    raise exception 'proposal not found' using errcode = 'P0002';
  end if;
  if p_by_id <> v_advertiser and p_by_id <> v_influencer then
    raise exception 'not a party' using errcode = 'P0010';
  end if;
  if p_date is null then
    raise exception 'date is required' using errcode = 'P0018';
  end if;

  v_receiver := case when p_by_id = v_advertiser then v_influencer else v_advertiser end;

  -- 제안 상태를 결제일로 표시. 진행일(start_at)은 그대로.
  update proposals
    set proposed_date = p_date,
        proposed_date_kind = 'settlement',
        proposed_by = p_by_id
  where id = p_proposal_id;

  -- (선택) 사유 한 줄
  if p_reason is not null and length(trim(p_reason)) > 0 then
    insert into messages (sender_id, receiver_id, proposal_id, content)
    values (p_by_id, v_receiver, p_proposal_id, trim(p_reason));
  end if;

  -- 결제일 제안 카드
  insert into messages (sender_id, receiver_id, proposal_id, content, proposed_date, proposed_date_kind)
  values (p_by_id, v_receiver, p_proposal_id, '', p_date, 'settlement');

  select name into v_by_name from profiles where id = p_by_id;
  insert into notifications (user_id, type, kind, title, body, link, ref_type, ref_id, state)
  values (
    v_receiver, 'settlement_date_proposal', 'settlement_date_proposal',
    '결제일 변경 제안이 왔어요',
    coalesce(v_by_name, '상대방') || '님이 결제일을 ' || to_char(p_date, 'FMMM월 FMDD일') || '로 제안했어요.',
    case when v_receiver = v_influencer
      then '/influencer/messages?receiverId=' || v_advertiser || '&proposalId=' || p_proposal_id
      else '/advertiser/messages' end,
    'proposal', p_proposal_id, 'unread'
  );
end;
$$;

revoke execute on function propose_settlement_date(uuid, uuid, date, text) from public, anon, authenticated;
grant  execute on function propose_settlement_date(uuid, uuid, date, text) to service_role;

-- 수락 — 종류에 따라 분기. 진행일 수락(0066)은 그대로 두고, 결제일이면 매출 시점만 옮긴다.
-- ⚠️ 결제일 수락은 start_at 을 건드리지 않고, 겹침 검사도 하지 않으며(진행일만 겹치면 안 됨),
--    지연 알림 카운터를 0으로 리셋한다(합의된 변경은 지연이 아니다 → 제재 근거 제거).
create or replace function accept_date_proposal(p_proposal_id uuid, p_by_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_advertiser uuid; v_influencer uuid; v_proposed_date date; v_proposed_by uuid; v_kind text;
begin
  select advertiser_id, influencer_id, proposed_date, proposed_by, proposed_date_kind
    into v_advertiser, v_influencer, v_proposed_date, v_proposed_by, v_kind
  from proposals where id = p_proposal_id;

  if v_proposed_date is null then
    raise exception 'no pending date proposal' using errcode = 'P0019';
  end if;
  if p_by_id <> v_advertiser and p_by_id <> v_influencer then
    raise exception 'not a party' using errcode = 'P0010';
  end if;
  if p_by_id = v_proposed_by then
    raise exception 'cannot accept own proposal' using errcode = 'P0020';
  end if;

  if v_kind = 'settlement' then
    update proposals
      set settlement_date = v_proposed_date,
          proposed_date = null,
          proposed_date_kind = null,
          proposed_by = null,
          overdue_reminder_count = 0
    where id = p_proposal_id;

    insert into messages (sender_id, receiver_id, proposal_id, content, is_system)
    select p_by_id, case when p_by_id = v_advertiser then v_influencer else v_advertiser end,
      p_proposal_id, '결제일을 ' || to_char(v_proposed_date, 'FMMM월 FMDD일') || '로 합의했어요', true;

    -- 제안한 사람에게 알림 (광고주=정산 목록, 인플루언서=매출 화면)
    insert into notifications (user_id, type, kind, title, body, link, ref_type, ref_id, state)
    values (
      v_proposed_by, 'settlement_date_agreed', 'settlement_date_agreed',
      '결제일이 합의됐어요',
      '결제일이 ' || to_char(v_proposed_date, 'FMMM월 FMDD일') || '로 정해졌어요.',
      case when v_proposed_by = v_advertiser then '/advertiser/settlements' else '/influencer/earnings' end,
      'proposal', p_proposal_id, 'unread'
    );
  else
    -- 진행일 수락 — 0066 동작 그대로
    update proposals
      set start_at = v_proposed_date::timestamptz,
          proposed_date = null,
          proposed_by = null
    where id = p_proposal_id;

    insert into messages (sender_id, receiver_id, proposal_id, content, is_system)
    select p_by_id, case when p_by_id = v_advertiser then v_influencer else v_advertiser end,
      p_proposal_id, to_char(v_proposed_date, 'MM월 DD일') || ' 날짜가 확정됐어요', true;
  end if;
end;
$$;

revoke execute on function accept_date_proposal(uuid, uuid) from public, anon, authenticated;
grant  execute on function accept_date_proposal(uuid, uuid) to service_role;

commit;
