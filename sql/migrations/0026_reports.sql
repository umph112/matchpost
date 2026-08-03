-- ① 신고 (reports)
create table if not exists reports (
  id             uuid primary key default gen_random_uuid(),
  reporter_id    uuid not null references profiles(id),
  counterpart_id uuid not null references profiles(id),
  source_type    text not null check (source_type in ('campaign', 'proposal')),
  source_id      uuid not null,
  type           text not null check (type in (
                   'unpaid', 'cancel_unilateral', 'guide_mismatch_req',
                   'draft_late', 'guide_violation', 'no_show',
                   'abuse', 'etc'
                 )),
  body           text not null,
  stage          text,
  snapshot       jsonb,
  status         text not null default 'open'
                   check (status in ('open', 'resolved', 'closed', 'escalated')),
  closed_by      uuid references profiles(id),
  close_reason   text,
  closed_at      timestamptz,
  created_at     timestamptz not null default now()
);

-- 본인 신고 불가
alter table reports
  add constraint reports_no_self_report
  check (reporter_id <> counterpart_id);

-- RLS
alter table reports enable row level security;

-- 본인이 신고한/신고당한 건만 조회
create policy "reports: read own" on reports
  for select using (
    reporter_id = auth.uid() or counterpart_id = auth.uid()
  );

-- 신고는 누구나 insert (reporter_id = 본인)
create policy "reports: insert own" on reports
  for insert with check (reporter_id = auth.uid());

-- 닫기는 reporter 또는 관리자만
create policy "reports: update closer" on reports
  for update using (
    auth.uid() = reporter_id
    or exists (
      select 1 from profiles where id = auth.uid() and role = 'admin'
    )
  );
