-- 0101  반려당한 뒤 다시 지원 (D32 2절 후속)
--
-- 반려는 「그 캠페인이 끝났다」는 뜻이 아니다. 조건을 바꿔 다시 지원할 수 있어야 한다.
-- 그런데 0098 의 중복 가드가 「한 캠페인에 한 줄」이라, 반려된 줄이 남아 있으면
-- 다시 지원하려는 순간 「이미 지원한 캠페인이에요」로 막혔다.
--
-- ⚠️ 새 줄을 만들지 않는다. 0098 이 못을 박아 둔 정책이 「한 사람 한 줄」이고
--    (proposals_one_per_campaign_influencer), 지원자 수와 「N / 모집 인원」 카운트가
--    그 위에 서 있다. 줄을 늘리면 한 사람이 지원자 목록에 두 번 뜬다.
--    그래서 반려된 그 줄을 다시 쓴다 — 0098 주석이 「취소된 협업을 되살릴 때도
--    새 줄을 만들지 말고 그 줄을 고쳐 써야 한다」고 적어둔 것과 같은 방식이다.
--
-- 0100 판에서 바뀐 곳은 두 군데뿐이다 — 「중복 가드」와 「저장」. 나머지는 그대로다.

begin;

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
  v_closed_at     timestamptz;
  v_content_start date;
  v_dates         jsonb;
  v_date          date;
  v_name          text;
  v_id            uuid;
  v_prev_id       uuid;
  v_prev_status   text;
begin
  select advertiser_id, title, status, is_public, campaign_type,
         recruit_end, recruit_closed_at, content_start, coalesce(dates::jsonb, '[]'::jsonb)
    into v_adv, v_title, v_status, v_public, v_type,
         v_recruit_end, v_closed_at, v_content_start, v_dates
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
  -- 모집 마감 가드 (0100 에서 추가)
  if v_closed_at is not null then
    raise exception '모집이 마감된 캠페인이에요.' using errcode = 'P0023';
  end if;
  if v_recruit_end is not null and v_recruit_end < current_date then
    raise exception '신청기간이 끝난 캠페인이에요.' using errcode = 'P0023';
  end if;

  -- ── 중복 가드 (0101 에서 바뀐 곳) ───────────────────────────────
  -- 반려된 줄은 막지 않는다. 그 줄을 아래에서 다시 쓴다.
  select id, status into v_prev_id, v_prev_status
  from proposals
  where campaign_id = p_campaign_id and influencer_id = p_influencer_id;

  if v_prev_id is not null and coalesce(v_prev_status, '') <> 'rejected' then
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

  -- ── 저장 (0101 에서 바뀐 곳) ────────────────────────────────────
  if v_prev_id is not null then
    -- 다시 지원. 이 줄이 곧 지원서라, 지원 날짜(created_at)도 새 날짜로 둔다 —
    -- 안 그러면 광고주 지원자 카드에 몇 주 전 날짜가 「지원」이라고 찍힌다.
    --
    -- reject_reason 은 지운다. 0100 이 「status='rejected' 인 줄에만 의미가 있다」고
    -- 못을 박아 뒀는데, pending 으로 돌아온 줄에 옛 사유가 남아 있으면 그 약속이 깨진다.
    -- 지원자는 다시 지원하기 전에 목록에서 사유를 읽는다 — 그때 제 몫을 다 한 값이다.
    --
    -- advertiser_confirmed 도 끈다. 광고주가 걸었던 대시를 인플루언서가 거절한 뒤
    -- 다시 지원하는 경우, 옛 「예」가 남아 있으면 광고주가 아무것도 안 눌렀는데
    -- 양쪽 확정이 되어 협업이 성사돼 버린다.
    update proposals
       set status               = 'pending',
           message              = nullif(trim(coalesce(p_message, '')), ''),
           initiated_by         = 'influencer',
           influencer_confirmed = true,
           advertiser_confirmed = false,
           reject_reason        = null,
           proposed_date        = v_date,
           proposed_by          = p_influencer_id,
           created_at           = now()
     where id = v_prev_id;
    v_id := v_prev_id;
  else
    insert into proposals (
      advertiser_id, influencer_id, campaign_id, message, status,
      initiated_by, influencer_confirmed, proposed_date, proposed_by
    ) values (
      v_adv, p_influencer_id, p_campaign_id, nullif(trim(coalesce(p_message, '')), ''), 'pending',
      'influencer', true, v_date, p_influencer_id
    ) returning id into v_id;
  end if;

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

-- ── 안 넣은 것 ──────────────────────────────────────────────────────
-- 재지원 쿨다운(며칠 지나야 다시 지원 가능)은 넣지 않았다.
-- 반복 알림을 막는 장치로 지시받은 것은 「버튼을 『다시 지원』으로 바꿔 이전에
-- 반려됐다는 것을 지원자가 알게 한다」 한 가지다. 시간 제한은 지시에 없었고,
-- 임의로 넣으면 「조건을 바꿔 다시 지원한다」는 원래 뜻을 내가 좁히는 셈이 된다.
-- 필요하다고 판단되면 proposals 에 마지막 반려 시각을 남겨 여기서 재면 된다.
