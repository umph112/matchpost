-- 0077  알림에 뜨는 광고주 이름을 상호(company_name) 우선으로 — PROMPT-6
--
-- 지금까지 대시/친구등록 알림은 profiles.name(담당자 이름)을 그대로 썼다. 인플루언서 입장에선
-- "홍길동님이 협업을 제안했어요"처럼 개인 이름이 떠서 어느 브랜드인지 알 수 없었다.
-- advertiser_profiles.company_name(가입 시 필수로 받는 상호)이 있으면 그걸 먼저 쓴다.
--
-- 두 함수는 create or replace 라서 원본(0076 register_connection · 0058 send_dash)을
-- 그대로 복제하고 "이름을 고르는 select 한 곳"만 바꾼다. 나머지 로직·게이트는 손대지 않는다.
--   광고주명 = coalesce(nullif(company_name,''), nullif(profiles.name,''), '광고주')
--   조인 키: advertiser_profiles.user_id = profiles.id (가입 라우트가 이 키로 저장)

begin;

-- ── register_connection (0076 복제 + 이름만 상호 우선) ──
create or replace function register_connection(
  p_by_id uuid, p_other_id uuid, p_source text, p_notify boolean default false
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_a uuid := least(p_by_id, p_other_id);
  v_b uuid := greatest(p_by_id, p_other_id);
  v_id uuid;
  v_by_name text;
begin
  if p_by_id = p_other_id then
    raise exception 'cannot connect to self' using errcode = 'P0018';
  end if;
  if p_source not in ('invite','collab','manual') then
    raise exception 'invalid source' using errcode = 'P0020';
  end if;

  -- on conflict do nothing: 이미 맺어진 행은 source 포함 그대로 둔다.
  select id into v_id from connections where a_id = v_a and b_id = v_b;
  if v_id is not null then
    return v_id;
  end if;

  insert into connections (a_id, b_id, a_ok, b_ok, source)
  values (v_a, v_b, true, true, p_source)
  returning id into v_id;

  if p_notify then
    select coalesce(nullif(ap.company_name, ''), nullif(p.name, ''), '광고주')
      into v_by_name
      from profiles p
      left join advertiser_profiles ap on ap.user_id = p.id
      where p.id = p_by_id;
    insert into notifications (user_id, type, kind, title, body, ref_type, ref_id, state)
    values (p_other_id, 'connection_registered', 'connection_registered',
      v_by_name || '이 회원님을 친구로 등록했어요',
      '다음 캠페인 소식을 먼저 받아볼 수 있어요.',
      'connection', v_id, 'unread');
  end if;

  return v_id;
end;
$$;

revoke execute on function register_connection(uuid, uuid, text, boolean) from public, anon, authenticated;
grant  execute on function register_connection(uuid, uuid, text, boolean) to service_role;

-- ── send_dash (0058 복제 + 이름만 상호 우선) ──
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

  select coalesce(nullif(ap.company_name, ''), nullif(p.name, ''), '광고주')
    into v_advertiser_name
    from profiles p
    left join advertiser_profiles ap on ap.user_id = p.id
    where p.id = p_advertiser_id;

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
