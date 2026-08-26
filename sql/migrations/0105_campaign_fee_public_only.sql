-- 0105  캠페인 등록 과금 — 공개된 것만
--
-- 0018:272 트리거는 캠페인 행이 생기기만 하면 5,000C 를 물렸다.
-- 비공개로 저장해 둔 초안, 만들다 만 캠페인에도 똑같이 청구됐다.
-- schedules(0018:288)는 이미 is_public 을 보고 있어 캠페인만 어긋나 있었다.
--
-- 함수 본문만 바꾼다 — 트리거는 그대로 둔다.
--
-- 확인(2026-08-26): 공개 캠페인 1건 → -5000 create_campaign · +500 encourage · +3000 first_action.
--                   비공개 캠페인 1건 → +3000 first_action 뿐(등록비·응원 없음).
--
-- 남은 것 둘(별건):
--  · 비공개로 만들었다가 나중에 공개로 바꾸면 영영 과금되지 않는다. schedules 도 같은 구멍이다.
--  · +3000 first_action(0064:37)은 credit_ledger 를 보지 않고 campaigns 행 수를 세어 판정한다.
--    캠페인을 지웠다 다시 만들면 다시 지급된다. 같은 파일 55행의 profile_complete 는
--    원장을 보고 판정하므로, 둘이 어긋나 있다.

begin;

create or replace function trg_fn_credit_campaign_open()
returns trigger language plpgsql security definer as $$
begin
  if new.is_public then
    perform credit_ledger_charge(new.advertiser_id, 5000, 'create_campaign', 'campaign', new.id, '캠페인 등록');
    perform credit_ledger_grant(new.advertiser_id, 500, 'reward', 'encourage', 'campaign', new.id, '캠페인 등록 응원 크레딧');
  end if;
  return new;
end;
$$;

commit;
