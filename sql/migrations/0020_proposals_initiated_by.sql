-- 0020  proposals.initiated_by — 제안을 먼저 보낸 쪽 기록
-- 개시자는 proposal 생성 시 앱에서 자신의 confirmed를 true로 함께 insert.
-- 토글 확정 시 이미 celebrate 크레딧이 지급된 proposal에는 재지급하지 않도록 트리거 수정.

begin;

alter table proposals
  add column if not exists initiated_by text
    check (initiated_by in ('advertiser', 'influencer'));

-- 기존 rows는 null 허용 — 신규 insert부터 앱이 값을 채운다.

-- celebrate 트리거 교체: 이미 지급된 proposal_id면 스킵 (토글로 인한 중복 방지)
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
      where ref_id = new.id and reason_code = 'celebrate'
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

commit;
