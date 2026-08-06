-- 0064  크레딧 정책 — profile_complete/first_action 훅 (SPEC-B-SETTLE.md §4)
--
-- 0061 커밋 메시지에서 "welcome/profile_complete/first_action/... 은 이미 있어 손대지 않는다"고
-- 적었는데, 실제로 다시 확인해보니 profile_complete/first_action은 코드 어디에도 훅이 없었다
-- (0018 주석에 reason_code 목록으로만 존재) — 잘못된 전제였다. 이번에 실제로 붙인다.
--
-- profile_complete는 스키마에 "완성" 플래그가 없어서, SPEC의 "프로필/채널 연동 완료" 문구를
-- 가장 가깝게 반영하는 근사치로 정의한다: 인플루언서는 blog_url이 null→값 있음으로 바뀔 때,
-- 광고주는 company_name이 null→값 있음으로 바뀔 때. 더 정확한 정의가 필요해지면 별도 결정 필요.

begin;

-- first_action — 계정당 첫 오픈/첫 캠페인일 때만, encourage(500C)와 별도로 3,000C 추가 지급
create or replace function trg_fn_credit_first_action_schedule()
returns trigger language plpgsql security definer as $$
declare
  v_count int;
begin
  select count(*) into v_count from schedules where influencer_id = new.influencer_id;
  if v_count = 1 then
    perform credit_ledger_grant(new.influencer_id, 3000, 'reward', 'first_action', 'schedule', new.id, '첫 오픈 등록 크레딧');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_first_action_schedule on schedules;
create trigger trg_first_action_schedule
  after insert on schedules
  for each row execute function trg_fn_credit_first_action_schedule();

create or replace function trg_fn_credit_first_action_campaign()
returns trigger language plpgsql security definer as $$
declare
  v_count int;
begin
  select count(*) into v_count from campaigns where advertiser_id = new.advertiser_id;
  if v_count = 1 then
    perform credit_ledger_grant(new.advertiser_id, 3000, 'reward', 'first_action', 'campaign', new.id, '첫 캠페인 개설 크레딧');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_first_action_campaign on campaigns;
create trigger trg_first_action_campaign
  after insert on campaigns
  for each row execute function trg_fn_credit_first_action_campaign();

-- profile_complete — 계정당 1회, null → 값 있음으로 바뀌는 순간만
create or replace function trg_fn_credit_profile_complete_influencer()
returns trigger language plpgsql security definer as $$
begin
  if old.blog_url is null and new.blog_url is not null then
    if not exists (
      select 1 from credit_ledger where user_id = new.user_id and reason_code = 'profile_complete'
    ) then
      perform credit_ledger_grant(new.user_id, 3000, 'reward', 'profile_complete', null, null, '프로필/채널 연동 완료 크레딧');
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_profile_complete_influencer on influencer_profiles;
create trigger trg_profile_complete_influencer
  after update on influencer_profiles
  for each row execute function trg_fn_credit_profile_complete_influencer();

create or replace function trg_fn_credit_profile_complete_advertiser()
returns trigger language plpgsql security definer as $$
begin
  if old.company_name is null and new.company_name is not null then
    if not exists (
      select 1 from credit_ledger where user_id = new.user_id and reason_code = 'profile_complete'
    ) then
      perform credit_ledger_grant(new.user_id, 3000, 'reward', 'profile_complete', null, null, '프로필 완성 크레딧');
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_profile_complete_advertiser on advertiser_profiles;
create trigger trg_profile_complete_advertiser
  after update on advertiser_profiles
  for each row execute function trg_fn_credit_profile_complete_advertiser();

commit;
