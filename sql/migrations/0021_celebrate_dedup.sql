-- 0021  celebrate 크레딧 중복 지급 완전 차단
-- 0020에서 reason_code만 체크했으나 ref_type='proposal' 조건도 추가해 명확히 한다.
-- 같은 proposal_id(ref_id)로 celebrate 행이 이미 있으면 이후 어떤 확정/철회 토글에도 재지급 안 함.

create or replace function trg_fn_credit_deal_celebrate()
returns trigger language plpgsql security definer as $$
begin
  if new.advertiser_confirmed = true and new.influencer_confirmed = true
     and (
       coalesce(old.advertiser_confirmed, false) = false
       or coalesce(old.influencer_confirmed, false) = false
     )
  then
    if not exists (
      select 1 from credit_ledger
      where ref_id = new.id
        and ref_type = 'proposal'
        and reason_code = 'celebrate'
    ) then
      perform credit_ledger_grant(
        new.advertiser_id, 2000, 'reward', 'celebrate',
        'proposal', new.id, '협업 성사 축하 크레딧'
      );
      perform credit_ledger_grant(
        new.influencer_id, 2000, 'reward', 'celebrate',
        'proposal', new.id, '협업 성사 축하 크레딧'
      );
    end if;
  end if;
  return new;
end;
$$;
