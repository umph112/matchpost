-- 0025  수금 확인 + 재정산 루프 스키마
--
-- 1. proposals: paid_confirmed_at, paid_disputed_at
-- 2. settlement_attempts: 재정산 회차 이력

begin;

-- ── 1. proposals 수금 확인 컬럼 ─────────────────────────────────────────
alter table proposals
  add column if not exists paid_confirmed_at timestamptz,  -- 인플루언서 수금 확인
  add column if not exists paid_disputed_at  timestamptz;  -- 미수금 신고

-- ── 2. settlement_attempts — 재정산 회차 이력 ───────────────────────────
-- settled_at은 지우지 않는다. 회차를 별도로 쌓는다.
-- 첫 기록 시 attempt_no=1, 재정산마다 +1
-- disputed_at: 인플루언서가 미수금 신고한 시각
-- resolved_at: 광고주가 재기록(resolve)한 시각
create table if not exists settlement_attempts (
  id           uuid primary key default gen_random_uuid(),
  proposal_id  uuid not null references proposals(id) on delete cascade,
  attempt_no   int  not null,
  recorded_at  timestamptz not null default now(),
  disputed_at  timestamptz,
  resolved_at  timestamptz
);

create index if not exists settlement_attempts_proposal_idx
  on settlement_attempts(proposal_id);

alter table settlement_attempts enable row level security;

drop policy if exists "attempts_via_proposal" on settlement_attempts;
create policy "attempts_via_proposal" on settlement_attempts
  for select using (
    exists (
      select 1 from proposals p
      where p.id = proposal_id
        and (auth.uid() = p.advertiser_id or auth.uid() = p.influencer_id)
    )
  );

commit;
