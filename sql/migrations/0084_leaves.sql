-- 0084  leaves / leave_notes — 팀원 휴무와 대타 (D14 4절)
--
-- 휴무는 「이관」이 아니라 「대타」다. 담당(manager_id)은 그대로 두고, 그 기간 동안
-- substitute_id 가 대신 본다. sql/migrations/ 전체에 leaves 테이블 없음(0건) 확인 후 신규 생성.
-- ⚠️ 기존 마이그레이션은 수정하지 않는다.

begin;

create table if not exists leaves (
  id uuid primary key default gen_random_uuid(),
  advertiser_id uuid not null references profiles(id) on delete cascade, -- 회사(대표)
  member_id uuid not null references profiles(id) on delete cascade,     -- 휴무 신청 팀원
  from_date date not null,
  to_date date not null,
  kind text not null check (kind in ('연차','반차','병가','기타')),
  reason text,
  status text not null default 'pending'
    check (status in ('pending','rejected','replied','approved','done')),
  substitute_id uuid references profiles(id), -- 대타 (이관 아님)
  created_at timestamptz not null default now()
);
create index if not exists leaves_adv_from_idx on leaves (advertiser_id, from_date);

-- 반려 사유·질문 등 휴무 관련 메모 (대표 ↔ 팀원)
create table if not exists leave_notes (
  id uuid primary key default gen_random_uuid(),
  leave_id uuid not null references leaves(id) on delete cascade,
  author_id uuid not null references profiles(id),
  text text not null,
  at timestamptz not null default now()
);

alter table leaves enable row level security;
alter table leave_notes enable row level security;

-- 회사(대표=advertiser_id) 와 신청 당사자(member_id) 가 읽고, 신청은 당사자가, 상태변경은 대표가.
-- 대표 여부는 team_members.owner_id 로 판별한다.
drop policy if exists leaves_read on leaves;
create policy leaves_read on leaves for select using (
  auth.uid() = member_id or auth.uid() = advertiser_id
);
drop policy if exists leaves_insert on leaves;
create policy leaves_insert on leaves for insert with check (
  auth.uid() = member_id or auth.uid() = advertiser_id
);
drop policy if exists leaves_update on leaves;
create policy leaves_update on leaves for update using (
  auth.uid() = member_id or auth.uid() = advertiser_id
);

drop policy if exists leave_notes_read on leave_notes;
create policy leave_notes_read on leave_notes for select using (
  exists (select 1 from leaves l where l.id = leave_notes.leave_id
          and (auth.uid() = l.member_id or auth.uid() = l.advertiser_id))
);
drop policy if exists leave_notes_insert on leave_notes;
create policy leave_notes_insert on leave_notes for insert with check (
  auth.uid() = author_id and exists (
    select 1 from leaves l where l.id = leave_notes.leave_id
    and (auth.uid() = l.member_id or auth.uid() = l.advertiser_id)
  )
);

commit;
