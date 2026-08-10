-- 0067  취소 수락이 딜시트/파생 숫자까지 전파되게 — D6 A8
--
-- 0053의 accept_cancellation()은 cancellations.agreed만 true로 바꿨다. 그래서 딜시트는
-- 여전히 "진행중"으로 보이고, 모집 확정·집행 예정액·팔로워 합계 같은 파생값도 취소된 사람을
-- 계속 셌다(전부 advertiser_confirmed && influencer_confirmed 기준으로 파생되므로).
--
-- 해법: 취소 수락 시 그 proposal의 확정 플래그를 둘 다 false로 내린다. 이러면 이미 존재하는
-- 모든 파생 계산(캠페인 목록/대시보드 KPI/딜시트 모집현황/정산 대상)이 코드를 안 고쳐도
-- 자동으로 취소된 사람을 뺀다 — "확정 쌍"이 유일한 진실 원본이기 때문이다.
-- 딜시트의 "취소" 배지·사유 표시는 cancellations(agreed=true)를 그대로 조회해서 만든다(행은 안 지움).

begin;

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

  -- A8: 파생값(모집 확정·집행 예정액·팔로워 합계·게재 수·딜시트 탭 카운트·대시보드 KPI)이
  -- 전부 확정 쌍에서 파생되므로, 여기서 내리는 것만으로 전부 취소를 반영하게 된다.
  update proposals set advertiser_confirmed = false, influencer_confirmed = false where id = v_deal_id;

  insert into notifications (user_id, type, kind, title, body, ref_type, ref_id, state)
  values (v_by_id, 'cancel_accepted', 'cancel_accepted',
    '협업 취소 요청이 수락됐어요', '상대방이 취소에 동의했어요.',
    'cancellation', p_cancellation_id, 'unread');
end;
$$;

commit;
