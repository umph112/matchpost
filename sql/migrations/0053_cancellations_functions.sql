-- 0053  협업 취소(cancellations) 요청/수락 루프 + 자동확정 + 90일 리셋
--
-- 단계 판정은 DealSheet.tsx의 실제 ALL_STAGES 배열 순서를 그대로 SQL에 옮겼다:
-- 신청(0) 확정(1) 가이드(2) 방문(3) 업로드(4) 수정/컴프(5) 검사(6) 정산(7).
-- 문서의 "가이드 후"는 인덱스 2 이상, "게재 후 취소 불가"는 게재 다음 단계인
-- "검사"(인덱스 6) 이상으로 매핑했다 — 문서에 정확한 8단계 라벨이 없어 실제 코드 기준으로 정함.
--
-- 카운트는 요청 시점에 부과한다("합의 취소는 무페널티(지표 반영 X)지만 요청 횟수는 센다"는
-- 문서 문구를 "결과와 무관하게 요청 자체를 센다"로 해석 — 3일 자동확정 배치는 추가 카운트 없이
-- agreed만 채운다(중복 부과 방지).

begin;

alter table profiles
  add column if not exists cancellation_count int not null default 0,
  add column if not exists last_cancellation_at timestamptz;


create or replace function request_cancellation(
  p_proposal_id uuid,
  p_by_id       uuid,
  p_reason      text,
  p_message     text
) returns uuid
language plpgsql
security definer
as $$
declare
  v_stage text;
  v_advertiser uuid;
  v_influencer uuid;
  v_counterpart uuid;
  v_stage_idx int;
  v_guide_idx   constant int := 2;  -- 가이드
  v_publish_idx constant int := 6;  -- 검사(게재 이후) — 이 단계부터 취소 불가
  v_cancellation_id uuid;
  v_inc int;
begin
  select advertiser_id, influencer_id, stage into v_advertiser, v_influencer, v_stage
  from proposals where id = p_proposal_id;

  if v_advertiser is null then
    raise exception 'proposal not found' using errcode = 'P0002';
  end if;
  if p_by_id <> v_advertiser and p_by_id <> v_influencer then
    raise exception 'not a party' using errcode = 'P0010';
  end if;

  v_counterpart := case when p_by_id = v_advertiser then v_influencer else v_advertiser end;

  v_stage_idx := coalesce(
    array_position(array['신청','확정','가이드','방문','업로드','수정/컴프','검사','정산'], v_stage),
    0
  );

  if v_stage_idx >= v_publish_idx then
    raise exception 'cannot cancel after publish stage' using errcode = 'P0014';
  end if;

  begin
    insert into cancellations (deal_id, by_id, reason, message, stage_at)
    values (p_proposal_id, p_by_id, p_reason, p_message, coalesce(v_stage, '신청'))
    returning id into v_cancellation_id;
  exception when unique_violation then
    raise exception 'cancellation already in progress' using errcode = 'P0015';
  end;

  v_inc := case when v_stage_idx >= v_guide_idx then 2 else 1 end;
  update profiles
  set cancellation_count = cancellation_count + v_inc,
      last_cancellation_at = now()
  where id = p_by_id;

  insert into notifications (user_id, type, kind, title, body, ref_type, ref_id, state)
  values (v_counterpart, 'cancel_request', 'cancel_request',
    '협업 취소를 요청했어요', '사유를 확인하고 대화로 조율하거나 수락해주세요.',
    'cancellation', v_cancellation_id, 'unread');

  return v_cancellation_id;
end;
$$;


create or replace function accept_cancellation(p_cancellation_id uuid, p_acceptor_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_by_id uuid;
  v_deal_id uuid;
  v_advertiser uuid;
  v_influencer uuid;
begin
  select c.by_id, c.deal_id into v_by_id, v_deal_id
  from cancellations c where c.id = p_cancellation_id and c.agreed is null;

  if v_by_id is null then
    raise exception 'not found or already resolved' using errcode = 'P0011';
  end if;
  if p_acceptor_id = v_by_id then
    raise exception 'requester cannot accept own request' using errcode = 'P0016';
  end if;

  select advertiser_id, influencer_id into v_advertiser, v_influencer
  from proposals where id = v_deal_id;

  if p_acceptor_id <> v_advertiser and p_acceptor_id <> v_influencer then
    raise exception 'not a party' using errcode = 'P0010';
  end if;

  update cancellations set agreed = true, agreed_at = now() where id = p_cancellation_id;

  insert into notifications (user_id, type, kind, title, body, ref_type, ref_id, state)
  values (v_by_id, 'cancel_accepted', 'cancel_accepted',
    '협업 취소 요청이 수락됐어요', '상대방이 취소에 동의했어요.',
    'cancellation', p_cancellation_id, 'unread');
end;
$$;


-- 무응답 3일 → 자동 취소 확정 (카운트는 요청 시점에 이미 부과, 여기서 재부과하지 않는다)
create or replace function run_cancellation_autoconfirm_batch()
returns table(cancellation_id uuid)
language plpgsql
security definer
as $$
declare r record;
begin
  for r in
    select id from cancellations
    where agreed is null and created_at <= now() - interval '3 days'
  loop
    update cancellations set agreed = true, agreed_at = now() where id = r.id;
    cancellation_id := r.id;
    return next;
  end loop;
end;
$$;


-- 90일 무취소 시 카운트 리셋 (1회씩 차감이 아니라 0으로)
create or replace function run_cancellation_count_reset_batch()
returns table(user_id uuid)
language plpgsql
security definer
as $$
declare r record;
begin
  for r in
    select id from profiles
    where cancellation_count > 0
      and last_cancellation_at is not null
      and last_cancellation_at < now() - interval '90 days'
  loop
    update profiles set cancellation_count = 0 where id = r.id;
    user_id := r.id;
    return next;
  end loop;
end;
$$;


create index if not exists cancellations_deal_idx on cancellations(deal_id);
create index if not exists cancellations_pending_idx on cancellations(created_at) where agreed is null;

revoke execute on function request_cancellation(uuid, uuid, text, text) from public, anon, authenticated;
grant  execute on function request_cancellation(uuid, uuid, text, text) to service_role;

revoke execute on function accept_cancellation(uuid, uuid) from public, anon, authenticated;
grant  execute on function accept_cancellation(uuid, uuid) to service_role;

revoke execute on function run_cancellation_autoconfirm_batch() from public, anon, authenticated;
grant  execute on function run_cancellation_autoconfirm_batch() to service_role;

revoke execute on function run_cancellation_count_reset_batch() from public, anon, authenticated;
grant  execute on function run_cancellation_count_reset_batch() to service_role;

commit;
