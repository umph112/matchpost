-- 0069  request_cancellation()의 단계 배열을 D6 9단계 이름으로 갱신
--
-- 0068에서 stage 저장값을 새 이름으로 바꿨는데(신청→협의, 검사→게재 등), 0053의
-- request_cancellation()은 옛 8단계 배열을 하드코딩하고 있어서 array_position이 전부
-- 못 찾는 상태가 된다(v_stage_idx가 항상 0으로 떨어져 "게재 이후엔 취소 불가" 체크가
-- 무력화됨). 다행히 '가이드'=2, '게재'=6 인덱스는 새 배열에서도 그대로라 배열 리터럴만
-- 바꾸면 된다(v_guide_idx/v_publish_idx 상수는 안 건드림).

begin;

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

  begin
    insert into cancellations (deal_id, by_id, reason, message, stage_at)
    values (p_proposal_id, p_by_id, p_reason, p_message, coalesce(v_stage, '협의'))
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

commit;
