-- 0098  캠페인 지원 — 인플루언서가 캠페인에 참여를 신청한다 (D32 1절)
--
-- 왜 필요한가.
--   캠페인을 등록할 수 있고 검색에도 보이는데, 참여하는 길이 없었다.
--   proposals 를 만드는 화면 네 곳이 전부 campaign_id 를 null 로 넘겨서
--   캠페인에 매달린 협업이 한 건도 생기지 않았다(실측: campaign_id 있는 proposals 0행).
--
-- ⚠️ send_dash() 를 재사용하지 않는 이유.
--   그 함수는 보내는 사람이 광고주라는 전제로 짜여 있다 —
--   initiated_by='advertiser', 메시지 sender=광고주, 알림 수신자=인플루언서.
--   지원에 그대로 태우면 알림이 지원자 본인에게 가고 방향이 뒤집힌다. 그래서 따로 만든다.
--
-- 「지원 → 확정」과 「대시 → 수락」은 같은 두 칸(advertiser_confirmed / influencer_confirmed)을
-- 순서만 바꿔 채운다. 지원은 인플루언서가 이미 「하겠다」고 한 것이므로
-- influencer_confirmed 를 여기서 켠다. 남은 한 칸은 광고주가 확정할 때 켠다(2절).

begin;

-- ── 1. 한 캠페인에 한 사람은 한 줄 ──────────────────────────────────
-- 화면에서만 막으면 창 두 개나 빠른 두 번 클릭으로 뚫린다(0096 과 같은 이유).
-- ⚠️ 이 못은 지원뿐 아니라 광고주의 캠페인 대시에도 걸린다. 그게 맞다 —
--    지원자 수와 「N / 모집 인원」 카운트가 「한 사람 한 줄」 위에 선다.
--    취소된 협업을 되살릴 때도 새 줄을 만들지 말고 그 줄을 고쳐 써야 한다.
create unique index if not exists proposals_one_per_campaign_influencer
  on proposals (campaign_id, influencer_id)
  where campaign_id is not null;

-- ── 2. 지원이 광고주 크레딧을 깎지 않게 ─────────────────────────────
-- proposals 에 줄이 생길 때마다 도는 트리거가 advertiser_id 에서 500을 뺀다(0018).
-- 지금은 0057 이 베타 무료로 꺼두어 실제로는 안 깎이지만, 그 과금을 다시 켜는 날
-- 인플루언서가 지원할 때마다 광고주가 자기가 하지 않은 일로 500을 물게 된다.
-- (잔액이 없으면 insufficient_credit 이 올라와 지원 자체가 실패한다.)
-- 조건 한 줄로 「인플루언서가 시작한 줄」을 빼둔다. 무료 정책은 그대로 둔다.
create or replace function trg_fn_credit_dash_send()
returns trigger language plpgsql security definer as $$
declare
  v_dash_fee_enabled constant boolean := false;  -- 베타 기간 대시 발송 무료 정책(0057)
begin
  if v_dash_fee_enabled and coalesce(new.initiated_by, 'advertiser') <> 'influencer' then
    perform credit_ledger_charge(new.advertiser_id, 500, 'send_proposal', 'proposal', new.id, '대시 발송');
  end if;
  return new;
end;
$$;

-- ── 3. 지원 ─────────────────────────────────────────────────────────
create or replace function apply_to_campaign(
  p_influencer_id uuid,
  p_campaign_id   uuid,
  p_message       text,
  p_date          date
) returns uuid
language plpgsql
security definer
as $$
declare
  v_adv           uuid;
  v_title         text;
  v_status        text;
  v_public        boolean;
  v_type          text;
  v_recruit_end   date;
  v_content_start date;
  v_dates         jsonb;
  v_date          date;
  v_name          text;
  v_id            uuid;
begin
  select advertiser_id, title, status, is_public, campaign_type,
         recruit_end, content_start, coalesce(dates::jsonb, '[]'::jsonb)
    into v_adv, v_title, v_status, v_public, v_type,
         v_recruit_end, v_content_start, v_dates
  from campaigns where id = p_campaign_id;

  if v_adv is null then
    raise exception '캠페인을 찾을 수 없어요.' using errcode = 'P0002';
  end if;
  if v_adv = p_influencer_id then
    raise exception '본인 캠페인에는 지원할 수 없어요.' using errcode = 'P0022';
  end if;
  if coalesce(v_status, '') <> 'open' or coalesce(v_public, false) = false then
    raise exception '모집이 끝난 캠페인이에요.' using errcode = 'P0023';
  end if;
  if v_recruit_end is not null and v_recruit_end < current_date then
    raise exception '신청기간이 끝난 캠페인이에요.' using errcode = 'P0023';
  end if;
  if exists (
    select 1 from proposals
    where campaign_id = p_campaign_id and influencer_id = p_influencer_id
  ) then
    raise exception '이미 지원한 캠페인이에요.' using errcode = 'P0024';
  end if;

  -- 진행일.
  --   지역 캠페인만 광고주가 방문 날짜를 미리 정해 둔다(campaigns.dates, 최대 30일).
  --   그래서 「기간 안에서 고르는」 것이 아니라 「정해 둔 날짜 중에서 고르는」 것이다.
  --   제품·기자단은 방문이 없어 진행일 자체를 받지 않는다 — 물으면 없는 것을 고르게 된다.
  --   그런 캠페인은 콘텐츠 등록 시작일을, 그것도 없으면 오늘을 진행일로 둔다.
  if v_type = '지역' then
    if p_date is null or not exists (
      select 1 from jsonb_array_elements(v_dates) e where (e ->> 'date')::date = p_date
    ) then
      raise exception '캠페인이 정한 날짜 중에서 골라야 해요.' using errcode = 'P0025';
    end if;
    v_date := p_date;
  else
    v_date := coalesce(v_content_start, current_date);
  end if;

  select name into v_name from profiles where id = p_influencer_id;

  insert into proposals (
    advertiser_id, influencer_id, campaign_id, message, status,
    initiated_by, influencer_confirmed, proposed_date, proposed_by
  ) values (
    v_adv, p_influencer_id, p_campaign_id, nullif(trim(coalesce(p_message, '')), ''), 'pending',
    'influencer', true, v_date, p_influencer_id
  ) returning id into v_id;

  -- 대화는 열되 「날짜 제안」 칩은 띄우지 않는다(send_dash 는 proposed_date 를 실은
  -- 메시지를 한 줄 더 넣는다). 이 날짜는 협의 대상이 아니라 광고주가 정해 둔 값이고,
  -- 광고주가 할 일은 날짜 수락이 아니라 확정 하나다.
  insert into messages (sender_id, receiver_id, proposal_id, content)
  values (p_influencer_id, v_adv, v_id, '「' || v_title || '」 캠페인에 지원했어요');

  if p_message is not null and length(trim(p_message)) > 0 then
    insert into messages (sender_id, receiver_id, proposal_id, content)
    values (p_influencer_id, v_adv, v_id, p_message);
  end if;

  insert into notifications (user_id, type, kind, title, body, link, ref_type, ref_id, state)
  values (
    v_adv, 'campaign_applied', 'campaign_applied',
    '캠페인에 지원이 들어왔어요',
    coalesce(v_name, '인플루언서') || '님이 「' || v_title || '」에 지원했어요.',
    '/advertiser/campaigns/' || p_campaign_id,
    'proposal', v_id, 'unread'
  );

  return v_id;
end;
$$;

revoke execute on function apply_to_campaign(uuid, uuid, text, date) from public, anon, authenticated;
grant  execute on function apply_to_campaign(uuid, uuid, text, date) to service_role;

commit;
