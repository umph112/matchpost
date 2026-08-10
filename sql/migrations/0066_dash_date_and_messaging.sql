-- 0066  대시 날짜 필수화 + 날짜 제안 수락/되제안 + 캠페인 대화 발송(브로드캐스트/개별) — D6 A6/A7/A3/A4
--
-- send_dash()는 0058에서 만들었지만 시그니처를 바꿔야 해서(날짜 필수 추가) drop 후 새로 만든다.
-- 날짜는 제안 단계에서는 proposals.proposed_date에 두고, 수락돼야 start_at으로 옮긴다(A7).

begin;

drop function if exists send_dash(uuid, uuid, uuid, uuid, text, int, text);

create or replace function send_dash(
  p_advertiser_id       uuid,
  p_influencer_id       uuid,
  p_schedule_id         uuid,
  p_campaign_id         uuid,
  p_message             text,
  p_budget              int,
  p_collaboration_type  text,
  p_date                date
) returns table(proposal_id uuid, resent boolean)
language plpgsql
security definer
as $$
declare
  v_existing_id uuid;
  v_advertiser_name text;
  v_id uuid;
begin
  if p_date is null then
    raise exception 'date is required' using errcode = 'P0018';
  end if;

  if p_campaign_id is not null then
    select id into v_existing_id
    from proposals
    where advertiser_id = p_advertiser_id and influencer_id = p_influencer_id and campaign_id = p_campaign_id
      and not (coalesce(advertiser_confirmed, false) and coalesce(influencer_confirmed, false))
    order by created_at desc limit 1;
  elsif p_schedule_id is not null then
    select id into v_existing_id
    from proposals
    where advertiser_id = p_advertiser_id and influencer_id = p_influencer_id and schedule_id = p_schedule_id
      and not (coalesce(advertiser_confirmed, false) and coalesce(influencer_confirmed, false))
    order by created_at desc limit 1;
  else
    select id into v_existing_id
    from proposals
    where advertiser_id = p_advertiser_id and influencer_id = p_influencer_id
      and campaign_id is null and schedule_id is null
      and not (coalesce(advertiser_confirmed, false) and coalesce(influencer_confirmed, false))
    order by created_at desc limit 1;
  end if;

  select name into v_advertiser_name from profiles where id = p_advertiser_id;

  if v_existing_id is not null then
    update proposals set
      message = coalesce(p_message, message),
      budget = coalesce(p_budget, budget),
      collaboration_type = coalesce(p_collaboration_type, collaboration_type),
      proposed_date = p_date,
      proposed_by = p_advertiser_id
    where id = v_existing_id;

    insert into messages (sender_id, receiver_id, proposal_id, content)
    values (p_advertiser_id, p_influencer_id, v_existing_id, '조건을 조정해 제안을 다시 보냈어요');
    insert into messages (sender_id, receiver_id, proposal_id, content, proposed_date)
    values (p_advertiser_id, p_influencer_id, v_existing_id, '', p_date);

    insert into notifications (user_id, type, kind, title, body, link, ref_type, ref_id, state)
    values (
      p_influencer_id, 'dash_received', 'dash_received', '제안 조건이 바뀌었어요',
      coalesce(v_advertiser_name, '광고주') || '님이 조건을 조정해 다시 제안했어요.',
      '/influencer/messages?receiverId=' || p_advertiser_id || '&proposalId=' || v_existing_id,
      'proposal', v_existing_id, 'unread'
    );

    proposal_id := v_existing_id; resent := true; return next;
  else
    insert into proposals (
      advertiser_id, influencer_id, schedule_id, campaign_id,
      message, budget, collaboration_type, status, initiated_by, proposed_date, proposed_by
    ) values (
      p_advertiser_id, p_influencer_id, p_schedule_id, p_campaign_id,
      p_message, p_budget, p_collaboration_type, 'pending', 'advertiser', p_date, p_advertiser_id
    ) returning id into v_id;

    insert into messages (sender_id, receiver_id, proposal_id, content)
    values (p_advertiser_id, p_influencer_id, v_id, '대시를 보냈어요');

    if p_message is not null and length(trim(p_message)) > 0 then
      insert into messages (sender_id, receiver_id, proposal_id, content)
      values (p_advertiser_id, p_influencer_id, v_id, p_message);
    end if;

    insert into messages (sender_id, receiver_id, proposal_id, content, proposed_date)
    values (p_advertiser_id, p_influencer_id, v_id, '', p_date);

    insert into notifications (user_id, type, kind, title, body, link, ref_type, ref_id, state)
    values (
      p_influencer_id, 'dash_received', 'dash_received', '새 대시가 도착했어요',
      coalesce(v_advertiser_name, '광고주') || '님이 협업을 제안했어요.',
      '/influencer/messages?receiverId=' || p_advertiser_id || '&proposalId=' || v_id,
      'proposal', v_id, 'unread'
    );

    proposal_id := v_id; resent := false; return next;
  end if;
end;
$$;

revoke execute on function send_dash(uuid, uuid, uuid, uuid, text, int, text, date) from public, anon, authenticated;
grant  execute on function send_dash(uuid, uuid, uuid, uuid, text, int, text, date) to service_role;

-- A7: 날짜 제안 수락 — 그 날짜가 곧바로 진행일(start_at)이 된다. 상대 제안만 수락 가능.
create or replace function accept_date_proposal(p_proposal_id uuid, p_by_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_advertiser uuid; v_influencer uuid; v_proposed_date date; v_proposed_by uuid;
begin
  select advertiser_id, influencer_id, proposed_date, proposed_by
    into v_advertiser, v_influencer, v_proposed_date, v_proposed_by
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

  update proposals
  set start_at = v_proposed_date::timestamptz,
      proposed_date = null,
      proposed_by = null
  where id = p_proposal_id;

  insert into messages (sender_id, receiver_id, proposal_id, content, is_system)
  select p_by_id, case when p_by_id = v_advertiser then v_influencer else v_advertiser end,
    p_proposal_id, to_char(v_proposed_date, 'MM월 DD일') || ' 날짜가 확정됐어요', true;
end;
$$;

revoke execute on function accept_date_proposal(uuid, uuid) from public, anon, authenticated;
grant  execute on function accept_date_proposal(uuid, uuid) to service_role;

-- A3/A4: 캠페인 대화 발송 — 브로드캐스트(참여자 전원) 또는 개별(한 명에게만)
create or replace function send_campaign_message(
  p_advertiser_id uuid,
  p_campaign_id   uuid,
  p_content       text,
  p_only_influencer_id uuid,  -- null이면 전원 브로드캐스트
  p_proxy         boolean
) returns void
language plpgsql
security definer
as $$
declare
  v_broadcast_id uuid := gen_random_uuid();
  r record;
begin
  if p_only_influencer_id is not null then
    select id into r from proposals
      where campaign_id = p_campaign_id and influencer_id = p_only_influencer_id
      order by created_at desc limit 1;
    if r.id is null then
      raise exception 'participant not found' using errcode = 'P0002';
    end if;
    insert into messages (sender_id, receiver_id, proposal_id, content, targeted_only, proxy)
    values (p_advertiser_id, p_only_influencer_id, r.id, p_content, true, coalesce(p_proxy, false));
  else
    for r in
      select distinct on (influencer_id) id, influencer_id
      from proposals
      where campaign_id = p_campaign_id
      order by influencer_id, created_at desc
    loop
      insert into messages (sender_id, receiver_id, proposal_id, content, broadcast_id, proxy)
      values (p_advertiser_id, r.influencer_id, r.id, p_content, v_broadcast_id, coalesce(p_proxy, false));
    end loop;
  end if;
end;
$$;

revoke execute on function send_campaign_message(uuid, uuid, text, uuid, boolean) from public, anon, authenticated;
grant  execute on function send_campaign_message(uuid, uuid, text, uuid, boolean) to service_role;

commit;
