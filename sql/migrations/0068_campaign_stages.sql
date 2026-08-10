-- 0068  조립식 진행 단계 — D6 B1~B4
--
-- 8단계 고정('신청'~'정산')을 9단계 조립식으로 바꾼다. 방문은 지역 캠페인 자동, 원고는
-- 수정/컨펌(사전 컨펌)에 딸리고, 게재뒤수정은 독립적으로 켜고 끈다.
-- 기존 proposals.stage 값은 새 이름으로 이관한다(신청→협의, 확정→수락, 업로드→원고,
-- 수정/컴프→수정/컨펌, 검사→게재). 그대로 두면 stageIndex가 못 알아봐서 전부 0으로
-- 되돌아가 보인다 — 반드시 같은 트랜잭션에서 함께 옮긴다.

begin;

alter table campaigns
  add column if not exists stage_pre_confirm boolean not null default true,
  add column if not exists stage_post_edit   boolean not null default false;

-- 확정 인원이 생기면 단계 구성을 못 바꾼다(B4) — 편집 화면에서 이 시점을 판정할 수 있게
-- "첫 확정 시각"을 추적. 없으면 앱에서 매번 proposals를 다시 훑어야 한다.
alter table campaigns
  add column if not exists first_confirmed_at timestamptz;

create or replace function trg_fn_campaign_first_confirmed()
returns trigger language plpgsql security definer as $$
begin
  if new.campaign_id is not null
     and new.advertiser_confirmed = true and new.influencer_confirmed = true
     and (coalesce(old.advertiser_confirmed, false) = false or coalesce(old.influencer_confirmed, false) = false)
  then
    update campaigns set first_confirmed_at = coalesce(first_confirmed_at, now()) where id = new.campaign_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_campaign_first_confirmed on proposals;
create trigger trg_campaign_first_confirmed
  after update on proposals
  for each row execute function trg_fn_campaign_first_confirmed();

-- 기존 저장값 이관 (한 번만 — idempotent: 이미 새 이름이면 매치 안 되니 안전)
update proposals set stage = '협의' where stage = '신청';
update proposals set stage = '수락' where stage = '확정';
update proposals set stage = '원고' where stage = '업로드';
update proposals set stage = '수정/컨펌' where stage = '수정/컴프';
update proposals set stage = '게재' where stage = '검사';

commit;
