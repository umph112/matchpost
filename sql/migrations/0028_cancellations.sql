-- ③ 협의 취소 (cancellations)
create table if not exists cancellations (
  id         uuid primary key default gen_random_uuid(),
  deal_id    uuid not null references proposals(id) on delete cascade,
  by_id      uuid not null references profiles(id),
  reason     text not null check (reason in (
               '개인 사정', '일정 중복', '조건 불일치', '건강 문제', '기타'
             )),
  message    text,
  stage_at   text not null,
  agreed     boolean,           -- null=대기, true=수락, false=거절
  agreed_at  timestamptz,
  created_at timestamptz not null default now()
);

-- 한 건에 진행 중인 취소 요청은 1개
create unique index cancellations_one_active
  on cancellations (deal_id)
  where agreed is null;

-- RLS
alter table cancellations enable row level security;

create policy "cancellations: read parties" on cancellations
  for select using (
    by_id = auth.uid()
    or exists (
      select 1 from proposals p
      where p.id = deal_id
        and (p.advertiser_id = auth.uid() or p.influencer_id = auth.uid())
    )
  );

create policy "cancellations: insert party" on cancellations
  for insert with check (
    by_id = auth.uid()
    and exists (
      select 1 from proposals p
      where p.id = deal_id
        and (p.advertiser_id = auth.uid() or p.influencer_id = auth.uid())
    )
  );

-- 상대방이 agreed 업데이트 (by_id 본인은 자신 취소 못 함)
create policy "cancellations: counterpart agree" on cancellations
  for update using (
    by_id <> auth.uid()
    and exists (
      select 1 from proposals p
      where p.id = deal_id
        and (p.advertiser_id = auth.uid() or p.influencer_id = auth.uid())
    )
  );
