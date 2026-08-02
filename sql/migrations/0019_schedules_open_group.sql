-- 0019  schedules.open_group_id — 오픈 1건이 여러 날짜(행)로 쪼개져 들어와도 크레딧은 1건만 차감
-- 정책: "오픈 1건당 1,000C, 날짜 수와 무관" (IMPLEMENT-1-SCHEMA.md 1번).
-- 0018에서는 schedules insert마다(=행마다) 차감했는데, 한 번의 오픈 등록이 여러 날짜 행으로
-- 나뉘어 들어오는 경우 날짜 수만큼 중복 차감되는 문제가 있었다.
-- ⚠️ 0018_credit_ledger.sql은 이미 커밋된 마이그레이션이라 직접 수정하지 않고 새 번호로 얹는다.

begin;

-- 기존 행은 default가 채워 넣는 새 uuid로 각자 자기 자신만의 그룹이 된다
-- (과거에 이미 개별 차감된 상태와 정합 — 소급 재차감 없음).
alter table schedules
  add column if not exists open_group_id uuid not null default gen_random_uuid();

create index if not exists schedules_open_group_idx on schedules(open_group_id);

-- 같은 open_group_id로 여러 행이 들어와도, 그 그룹의 "첫 행"에서만 차감·응원 지급.
-- 한 번의 오픈 등록에서 여러 날짜를 같은 open_group_id로 insert하면(동일 트랜잭션이든 순차든)
-- 먼저 들어온 행만 그 시점에 같은 그룹의 다른 행이 없으므로 차감되고, 나머지는 스킵된다.
create or replace function trg_fn_credit_schedule_open()
returns trigger language plpgsql security definer as $$
begin
  if new.is_public then
    if not exists (
      select 1 from schedules
      where open_group_id = new.open_group_id and id <> new.id
    ) then
      perform credit_ledger_charge(new.influencer_id, 1000, 'open_schedule', 'schedule', new.id, '오픈 등록');
      perform credit_ledger_grant(new.influencer_id, 500, 'reward', 'encourage', 'schedule', new.id, '오픈 등록 응원 크레딧');
    end if;
  end if;
  return new;
end;
$$;

commit;
