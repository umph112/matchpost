-- 0048  재정산 루프 제대로 구현 — settlement_attempts(0025, 지금까지 미사용) 실제로 쓴다
--
-- 기존 DealSheet.tsx handleReSettle은 proposals.settled_at을 직접 덮어쓰려 했는데,
-- 0023의 trg_fn_proposals_settled_immutable 트리거가 이미 값이 있는 settled_at을
-- 다른 값으로 바꾸는 UPDATE 자체를 막는다 — 누르면 DB 에러로 실패하는 상태였다.
-- settled_at은 절대 건드리지 않고, settlement_attempts에 회차만 쌓는 방식으로 재작성한다.
--
-- 이력이 비어있는 상태(지금까지 아무 정산도 settlement_attempts를 안 썼으므로 항상 이 경우)에서
-- 최초 신고가 들어오면, 그 시점에 최초 정산(attempt 1)을 소급 기록하고 신고를 attempt 1의
-- disputed_at으로 채운다. 이후 재정산마다 새 attempt를 쌓는다.

begin;

create or replace function re_settle_campaign(p_proposal_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v   proposals%rowtype;
  cp  deal_checkpoints%rowtype;
  v_now timestamptz := now();
  v_attempt_no int;
  v_late int;
begin
  select * into v from proposals where id = p_proposal_id for update;
  if not found then
    raise exception 'proposal not found' using errcode = 'P0002';
  end if;
  if v.settled_at is null then
    raise exception 'not settled yet' using errcode = 'P0006';
  end if;
  if v.paid_disputed_at is null then
    raise exception 'no dispute to resolve' using errcode = 'P0007';
  end if;

  select coalesce(max(attempt_no), 0) into v_attempt_no
    from settlement_attempts where proposal_id = p_proposal_id;

  if v_attempt_no = 0 then
    -- 첫 신고 — 최초 정산을 attempt 1로 소급 기록하고 이번 신고로 해결 처리
    insert into settlement_attempts (proposal_id, attempt_no, recorded_at, disputed_at, resolved_at)
    values (p_proposal_id, 1, v.settled_at, v.paid_disputed_at, v_now);
    v_attempt_no := 1;
  else
    update settlement_attempts
    set resolved_at = v_now
    where proposal_id = p_proposal_id and attempt_no = v_attempt_no and resolved_at is null;
  end if;

  insert into settlement_attempts (proposal_id, attempt_no, recorded_at)
  values (p_proposal_id, v_attempt_no + 1, v_now);

  -- settled_at은 그대로 둔다 — 회차만 쌓는다(문서 요구사항)
  update proposals
  set paid_disputed_at = null, paid_confirmed_at = null
  where id = p_proposal_id;

  -- 정산 성실도는 최초 기록일이 아니라 "신고 없이 확정된 날" 기준 —
  -- payment 체크포인트를 이번 재정산 시점으로 재계산
  select * into cp
  from deal_checkpoints
  where proposal_id = p_proposal_id and kind = 'payment';

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

  -- 재정산 2회 초과(3번째 이상 시도)면 운영팀 자동 에스컬레이션
  if v_attempt_no + 1 > 2 then
    insert into notifications (user_id, type, kind, title, body, ref_type, ref_id, state)
    select
      id, 'ops_escalation', 'ops_escalation',
      '재정산 3회 이상 — 확인이 필요해요',
      '정산이 ' || (v_attempt_no + 1) || '회째 다시 기록되고 있어요.',
      'proposal', p_proposal_id, 'unread'
    from profiles where is_admin = true;
  end if;

  -- 신고했던 인플루언서에게만 재확인 요청(상대는 다시 안 물음)
  insert into notifications (user_id, type, kind, title, body, link, ref_type, ref_id, state)
  values (
    v.influencer_id, 'paid_confirm_request', 'paid_confirm_request',
    '광고주가 정산을 다시 기록했어요', '입금을 확인해주세요.',
    '/influencer/earnings', 'proposal', p_proposal_id, 'unread'
  );
end;
$$;

-- 0046/0047과 같은 이유로 잠금 — service_role 경로(reSettleCampaign 서버 액션)로만 호출
revoke execute on function re_settle_campaign(uuid) from public, anon, authenticated;
grant  execute on function re_settle_campaign(uuid) to service_role;

commit;
