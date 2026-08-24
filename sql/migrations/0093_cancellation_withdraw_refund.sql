-- 0093  취소 요청을 철회하면 부과분을 되돌린다 (0059의 결정을 뒤집는다)
--
-- 0059는 "요청 시점에 부과한 cancellation_count는 철회해도 되돌리지 않는다"로 갔다.
-- 그런데 cancellation_count는 횟수가 아니라 점수고(가이드 이후 취소는 +2), 이 점수가
-- 공개 프로필의 「취소 요청 잦음」 배지 근거가 된다. 잘못 눌러 곧바로 철회한 요청까지
-- 점수로 남으면 낙인의 근거가 틀려진다. 철회를 정확히 되돌리면 요청 시점 부과(0053)를
-- 그대로 유지해도 문제되지 않는다 — 그래서 부과 시점은 건드리지 않는다.
--
-- 되돌릴 값을 아는 방법:
--   stage_at 으로 가중치를 재계산할 수도 있지만, 0068→0069에서 단계 이름이 실제로 한 번
--   바뀌었고 그때 array_position이 전부 null로 떨어져 판정이 무력화된 전례가 있다. 이름이
--   또 바뀌면 과거 행이 틀린 값으로 환불된다. 그래서 재계산이 아니라 부과액을 그대로
--   기록해 둔다(count_delta). 단계 이름이 어떻게 바뀌든 환불은 정확하다.

begin;

alter table cancellations
  add column if not exists count_delta int;

comment on column cancellations.count_delta is
  '요청 시점에 profiles.cancellation_count에 더한 점수. 철회 시 정확히 이만큼 되돌린다.';


-- 0069와 동일 — 부과액을 행에 함께 기록하는 것만 추가했다(부과 시점·금액 무변경).
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
  v_publish_idx constant int := 6;  -- 게재(게재 이후) — 이 단계부터 취소 불가
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
    array_position(array['협의','수락','가이드','방문','원고','수정/컨펌','게재','게재뒤수정','정산'], v_stage),
    1
  ) - 1;

  if v_stage_idx >= v_publish_idx then
    raise exception 'cannot cancel after publish stage' using errcode = 'P0014';
  end if;

  v_inc := case when v_stage_idx >= v_guide_idx then 2 else 1 end;

  begin
    insert into cancellations (deal_id, by_id, reason, message, stage_at, count_delta)
    values (p_proposal_id, p_by_id, p_reason, p_message, coalesce(v_stage, '협의'), v_inc)
    returning id into v_cancellation_id;
  exception when unique_violation then
    raise exception 'cancellation already in progress' using errcode = 'P0015';
  end;

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


create or replace function withdraw_cancellation(p_cancellation_id uuid, p_by_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_by_id    uuid;
  v_stage_at text;
  v_delta    int;
  v_prev     timestamptz;
begin
  select by_id, stage_at, count_delta
    into v_by_id, v_stage_at, v_delta
  from cancellations where id = p_cancellation_id and agreed is null;

  if v_by_id is null then
    raise exception 'not found or already resolved' using errcode = 'P0011';
  end if;
  if p_by_id <> v_by_id then
    raise exception 'only the requester can withdraw' using errcode = 'P0017';
  end if;

  -- count_delta 이전에 만들어진 행에 대한 폴백. 철회는 미확정 행에만 되고 미확정 행은
  -- 3일 자동확정 배치가 걷어가므로 이 경로는 사실상 비어 있다.
  if v_delta is null then
    v_delta := case
      when coalesce(array_position(
             array['협의','수락','가이드','방문','원고','수정/컨펌','게재','게재뒤수정','정산'],
             v_stage_at), 1) - 1 >= 2
      then 2 else 1 end;
  end if;

  delete from cancellations where id = p_cancellation_id;

  -- 남은 요청 중 가장 최근 것으로 시계를 되돌린다. 철회한 요청이 60일 리셋(0092)을
  -- 붙잡고 있으면 안 된다. 남은 요청이 없으면 null — 이때 카운트도 0이라 배치가 건너뛴다.
  select max(created_at) into v_prev from cancellations where by_id = v_by_id;

  update profiles
  set cancellation_count = greatest(cancellation_count - v_delta, 0),
      last_cancellation_at = v_prev
  where id = v_by_id;
end;
$$;

revoke execute on function request_cancellation(uuid, uuid, text, text) from public, anon, authenticated;
grant  execute on function request_cancellation(uuid, uuid, text, text) to service_role;

revoke execute on function withdraw_cancellation(uuid, uuid) from public, anon, authenticated;
grant  execute on function withdraw_cancellation(uuid, uuid) to service_role;

commit;
