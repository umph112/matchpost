-- 0058  대시 보내기 통합 (IMPLEMENT-5-DELTA.md A3/A4)
--
-- 지금까지 두 갈래로 갈려 있던 발송 경로(proposals/new 전체 폼은 대화를 안 열고,
-- 캘린더/검색의 "대시 보내기"는 proposals 행을 안 만듦)를 send_dash() 하나로 합친다.
-- 같은 상대 + 같은 캠페인/오픈(또는 둘 다 없는 순수 커넥션 대시)에 아직 양쪽 미확정인
-- proposals 행이 있으면 새로 만들지 않고 그 행을 갱신 + 재전송 안내로 분기(A4).

begin;

create or replace function send_dash(
  p_advertiser_id       uuid,
  p_influencer_id       uuid,
  p_schedule_id         uuid,
  p_campaign_id         uuid,
  p_message             text,
  p_budget              int,
  p_collaboration_type  text
) returns table(proposal_id uuid, resent boolean)
language plpgsql
security definer
as $$
declare
  v_existing_id uuid;
  v_advertiser_name text;
  v_id uuid;
begin
  if p_campaign_id is not null then
    select id into v_existing_id
    from proposals
    where advertiser_id = p_advertiser_id
      and influencer_id = p_influencer_id
      and campaign_id = p_campaign_id
      and not (coalesce(advertiser_confirmed, false) and coalesce(influencer_confirmed, false))
    order by created_at desc
    limit 1;
  elsif p_schedule_id is not null then
    select id into v_existing_id
    from proposals
    where advertiser_id = p_advertiser_id
      and influencer_id = p_influencer_id
      and schedule_id = p_schedule_id
      and not (coalesce(advertiser_confirmed, false) and coalesce(influencer_confirmed, false))
    order by created_at desc
    limit 1;
  else
    select id into v_existing_id
    from proposals
    where advertiser_id = p_advertiser_id
      and influencer_id = p_influencer_id
      and campaign_id is null
      and schedule_id is null
      and not (coalesce(advertiser_confirmed, false) and coalesce(influencer_confirmed, false))
    order by created_at desc
    limit 1;
  end if;

  select name into v_advertiser_name from profiles where id = p_advertiser_id;

  if v_existing_id is not null then
    update proposals set
      message = coalesce(p_message, message),
      budget = coalesce(p_budget, budget),
      collaboration_type = coalesce(p_collaboration_type, collaboration_type)
    where id = v_existing_id;

    insert into messages (sender_id, receiver_id, proposal_id, content)
    values (p_advertiser_id, p_influencer_id, v_existing_id, '조건을 조정해 제안을 다시 보냈어요');

    insert into notifications (user_id, type, kind, title, body, link, ref_type, ref_id, state)
    values (
      p_influencer_id, 'dash_received', 'dash_received',
      '제안 조건이 바뀌었어요',
      coalesce(v_advertiser_name, '광고주') || '님이 조건을 조정해 다시 제안했어요.',
      '/influencer/messages?receiverId=' || p_advertiser_id || '&proposalId=' || v_existing_id,
      'proposal', v_existing_id, 'unread'
    );

    proposal_id := v_existing_id;
    resent := true;
    return next;
  else
    insert into proposals (
      advertiser_id, influencer_id, schedule_id, campaign_id,
      message, budget, collaboration_type, status, initiated_by
    ) values (
      p_advertiser_id, p_influencer_id, p_schedule_id, p_campaign_id,
      p_message, p_budget, p_collaboration_type, 'pending', 'advertiser'
    ) returning id into v_id;

    insert into messages (sender_id, receiver_id, proposal_id, content)
    values (p_advertiser_id, p_influencer_id, v_id, '대시를 보냈어요');

    if p_message is not null and length(trim(p_message)) > 0 then
      insert into messages (sender_id, receiver_id, proposal_id, content)
      values (p_advertiser_id, p_influencer_id, v_id, p_message);
    end if;

    insert into notifications (user_id, type, kind, title, body, link, ref_type, ref_id, state)
    values (
      p_influencer_id, 'dash_received', 'dash_received',
      '새 대시가 도착했어요',
      coalesce(v_advertiser_name, '광고주') || '님이 협업을 제안했어요.',
      '/influencer/messages?receiverId=' || p_advertiser_id || '&proposalId=' || v_id,
      'proposal', v_id, 'unread'
    );

    proposal_id := v_id;
    resent := false;
    return next;
  end if;
end;
$$;

revoke execute on function send_dash(uuid, uuid, uuid, uuid, text, int, text) from public, anon, authenticated;
grant  execute on function send_dash(uuid, uuid, uuid, uuid, text, int, text) to service_role;

commit;
