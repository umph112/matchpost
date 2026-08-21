-- 0090  방문지(proposal_stops) · 제공받는 것(perk) · 숙박 여부(is_stay) — D24 §1
--
-- 오픈 묶음 보기(/influencer/schedule/[id])가 「그날 몇 시에 어디를 가고 총 얼마를 받나」를
-- 그리려면 세 가지가 필요하다. sql/migrations 전체를 검색해 셋 다 없음(0건)을 확인했다.
--
-- ⚠️ schedules.fee 를 금액으로 쓰지 않는다. text(「30만원~」)이고 오픈의 희망 페이다.
--    실제 금액은 proposals.budget 이다.
-- ⚠️ 기존 마이그레이션은 수정하지 않는다.

begin;

-- ── ① 한 건에 방문지 여러 곳 ──────────────────────────────────────────
--    꼬북 두 지점을 묶어 10만원, 박람회장·돌산을 묶어 50만원처럼 여러 곳이 한 건인 경우가 흔하다.
--    방문마다 proposal 을 나누면 한 건이 두 건으로 세어지고 금액이 두 번 잡힌다.
create table if not exists proposal_stops (
  id          uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references proposals(id) on delete cascade,
  at          time not null,          -- 방문 시각
  name        text not null,          -- 「여서점」 「돌산 진모지구」
  place       text,                   -- 간략 위치. 인플루언서가 적는다. 빈 값이 정상
  sort        int not null default 0
);
create index if not exists proposal_stops_proposal_at_idx on proposal_stops (proposal_id, at);

-- RLS — 새 테이블은 켜지 않으면 남의 일정이 보인다.
-- 조회는 그 건의 당사자(광고주·인플루언서) 둘 다. 쓰기는 자기 일정을 적는 인플루언서만.
alter table proposal_stops enable row level security;

create policy "proposal_stops: read parties" on proposal_stops
  for select using (
    exists (
      select 1 from proposals p
      where p.id = proposal_id
        and (p.advertiser_id = auth.uid() or p.influencer_id = auth.uid())
    )
  );

create policy "proposal_stops: insert influencer" on proposal_stops
  for insert with check (
    exists (
      select 1 from proposals p
      where p.id = proposal_id and p.influencer_id = auth.uid()
    )
  );

create policy "proposal_stops: update influencer" on proposal_stops
  for update using (
    exists (
      select 1 from proposals p
      where p.id = proposal_id and p.influencer_id = auth.uid()
    )
  );

create policy "proposal_stops: delete influencer" on proposal_stops
  for delete using (
    exists (
      select 1 from proposals p
      where p.id = proposal_id and p.influencer_id = auth.uid()
    )
  );

-- ── ② 제공받는 것 (원고료와 별개) ─────────────────────────────────────
alter table proposals add column if not exists perk text;
comment on column proposals.perk is
  '원고료 외에 제공받는 것. 「1박 제공」 「서비스 제공」. 인플루언서가 실제 받은 대로 고칠 수 있다.';

-- ── ③ 숙박 여부 — 시간 배정 규칙이 다르다 ─────────────────────────────
alter table proposals add column if not exists is_stay boolean not null default false;

-- ── ④ 제공 표현 고치기 ────────────────────────────────────────────────
--    광고주가 「서비스 제공」이라 적어도 실제로 무엇을 받았는지는 인플루언서가 안다.
--    금액(budget)은 합의된 값이라 대시에서만 바뀐다 — 이 함수는 perk 만 건드린다.
--    proposals 의 UPDATE 정책을 마이그레이션에서 확인할 수 없어, 0087 과 같은
--    security definer + 본인 검증 방식으로 좁게 연다.
create or replace function set_proposal_perk(
  p_proposal_id uuid,
  p_by_id       uuid,
  p_perk        text
)
returns void
language plpgsql
security definer
as $$
declare
  v proposals%rowtype;
begin
  select * into v from proposals where id = p_proposal_id for update;
  if not found then
    raise exception 'proposal not found' using errcode = 'P0002';
  end if;

  -- 실제로 받은 사람만 고칠 수 있다 — 그 proposal 의 인플루언서 && 호출자 == 본인
  if v.influencer_id is distinct from p_by_id then
    raise exception 'not your proposal' using errcode = 'P0001';
  end if;
  if auth.uid() is distinct from p_by_id then
    raise exception 'caller mismatch' using errcode = 'P0001';
  end if;

  update proposals
    set perk = nullif(btrim(coalesce(p_perk, '')), '')
  where id = p_proposal_id;
end;
$$;

revoke execute on function set_proposal_perk(uuid, uuid, text) from public;
revoke execute on function set_proposal_perk(uuid, uuid, text) from anon;
grant  execute on function set_proposal_perk(uuid, uuid, text) to authenticated;

commit;
