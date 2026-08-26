-- 0100  지원자 확정·반려 — 광고주가 고른다 (D32 2절)
--
-- 1절로 지원은 들어오는데, 광고주 쪽에는 그 지원을 「받는다/안 받는다」고 말할 곳이 없었다.
-- 지원자가 딜시트 표에 확정된 사람과 같은 줄로 섞여 들어가서, 확정 전과 후가 구분되지 않았다.
--
-- 여기서 만드는 것은 세 가지다.
--   1. proposals.reject_reason      — 왜 반려됐는지를 줄에 남긴다
--   2. campaigns.recruit_closed_at  — 모집을 「자동이 아니라 광고주가」 닫는다
--   3. apply_to_campaign 에 2번 가드 추가 (0098 판을 대체한다)
--
-- ⚠️ 확정·반려 자체는 여기 함수로 만들지 않는다. 서버액션(lib/deals/applicants.ts)이
--    당사자를 확인하고 바뀐 행 수를 세는 D29 방식으로 처리한다. 이 마이그레이션은
--    그 액션이 쓸 칸과, 지원을 막아야 할 조건만 마련한다.

begin;

-- ── 1. 반려 사유 ────────────────────────────────────────────────────
-- 대화에만 남기면 목록에서 「왜 반려됐나」를 볼 수 없다 — 지원자가 스크롤해 찾아야 한다.
-- 사유는 선택이다. 안 적고 반려해도 되고, 그때는 null 이 남는다.
alter table proposals add column if not exists reject_reason text;

comment on column proposals.reject_reason is
  '반려 사유(선택). status=''rejected'' 인 줄에만 의미가 있다. 광고주가 안 적으면 null.';

-- ── 2. 모집 마감 ────────────────────────────────────────────────────
-- 모집 인원을 채워도 자동으로 닫지 않는다. 「N명 확정 · 모집 인원 도달」이라고 알리기만 하고,
-- 닫는 것은 광고주가 버튼으로 한다 — 한 명 더 받고 싶은 경우가 실제로 있기 때문이다.
--
-- ⚠️ 왜 status 나 recruit_end 를 재사용하지 않았나.
--    · campaigns.status 는 open|cancelled|completed 뿐이고, 캠페인 목록이 그 값을
--      「캔슬 / 완료」로 읽는다(advertiser/campaigns/page.tsx). 모집만 닫은 건이
--      캔슬로 보이면 안 된다.
--    · recruit_end 는 광고주가 화면에 적어 둔 신청 마감일이다. 여기에 어제 날짜를 써넣으면
--      「내가 적은 마감일」이 바뀐 것처럼 보인다. 사람이 적은 값과 시스템이 닫은 사실은
--      다른 칸에 둔다.
alter table campaigns add column if not exists recruit_closed_at timestamptz;

comment on column campaigns.recruit_closed_at is
  '광고주가 모집을 닫은 시각. null 이면 모집 중. 모집 인원이 차도 자동으로 채워지지 않는다 — 광고주가 「모집 마감」을 눌러야 한다.';

-- ── 3. 지원 함수에 모집 마감 가드 ───────────────────────────────────
-- 0098 의 apply_to_campaign 과 같은 본문에 가드 한 개만 더 붙였다.
-- (plpgsql 은 부분 교체가 안 돼서 전문을 다시 쓴다. 아래 「모집 마감 가드」 주석이 유일한 차이다.)
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

-- ── 부록. 레포에 없는 트리거 기록 ───────────────────────────────────
-- 0099 로 잘못된 대시 알림 트리거를 지운 뒤 남은 목록을 마이그레이션과 대조했다.
-- 열 개 중 아홉은 레포에 있다(0018·0023·0024·0056·0064·0068·0070).
-- 레포에 없는 것은 아래 하나뿐이고, 이건 「남긴다」로 판단했다 —
-- 광고주 본인에게 자기 캠페인 등록·수정·완료·취소를 알리는 것이라 방향이 옳다.
--
--   CREATE TRIGGER trg_campaign_notify
--     AFTER INSERT OR UPDATE ON public.campaigns
--     FOR EACH ROW EXECUTE FUNCTION notify_campaign_event()
--
-- 본문(2026-08-26 pg_get_functiondef 로 떠서 그대로 옮김):
--
--   CREATE OR REPLACE FUNCTION public.notify_campaign_event()
--    RETURNS trigger
--    LANGUAGE plpgsql
--    SECURITY DEFINER
--    SET search_path TO 'public'
--   AS $function$
--   begin
--     if TG_OP='INSERT' then
--       insert into notifications(user_id,type,title,body,link,related_id)
--         values (NEW.advertiser_id,'campaign_created','캠페인이 등록되었습니다',NEW.title,'/advertiser/dashboard',NEW.id);
--     elsif TG_OP='UPDATE' then
--       if NEW.status is distinct from OLD.status then
--         if NEW.status='cancelled' then
--           insert into notifications(user_id,type,title,body,link,related_id)
--             values (NEW.advertiser_id,'campaign_cancelled','캠페인이 취소되었습니다',NEW.title,'/advertiser/dashboard',NEW.id);
--         elsif NEW.status='completed' then
--           insert into notifications(user_id,type,title,body,link,related_id)
--             values (NEW.advertiser_id,'campaign_completed','캠페인이 완료되었습니다',NEW.title,'/advertiser/dashboard',NEW.id);
--         end if;
--       else
--         insert into notifications(user_id,type,title,body,link,related_id)
--           values (NEW.advertiser_id,'campaign_updated','캠페인이 수정되었습니다',NEW.title,'/advertiser/dashboard',NEW.id);
--       end if;
--     end if;
--     return NEW;
--   end $function$
--
-- 읽고 알게 된 두 가지 —
--   ① UPDATE 에서 status 가 그대로면 **무조건** '캠페인이 수정되었습니다'를 넣는다.
--      그래서 이 마이그레이션이 추가한 recruit_closed_at 을 채우는 「모집 마감」도
--      광고주 본인에게 수정 알림 한 줄을 남긴다. 틀린 말은 아니라 그대로 뒀다.
--   ② ref_type/ref_id 가 아니라 related_id 를 쓴다. 그래서 ref_id 로 훑는 정리 코드에
--      안 걸린다 — 30번 스펙이 [봇검증] 문구로 한 번 더 훑는 이유가 이것이다.
--
-- 다음에 또 레포에 없는 트리거를 발견하면 지우든 남기든 이렇게 이름과 정의를 남긴다 —
-- 이번 세션에만 RLS 정책·트리거로 같은 일이 두 번 있었다.
