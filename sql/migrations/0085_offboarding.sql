-- 0085  offboarding — 퇴사 예정 + 이관 기록 (D14 5절)
--
-- 「해제」(즉시 inactive)를 「퇴사 예정으로 전환」으로 바꾼다. 대표가 합의한 퇴사일(leave_on)을
-- 적고, 그날이 지나면 대표가 남은 담당 건을 대신 이관한다.
--
-- ⚠️ 값으로 잰다: 기존 team_members.status 는 영문 ('invited','active','inactive') 이다.
-- 스펙 문구는 '퇴사 예정' 이지만 컬럼 관례에 맞춰 'leaving' 을 쓰고, UI 라벨에서 '퇴사 예정'으로 보인다
-- (STATUS_LABEL['invited']='초대 대기' 와 동일한 방식).
-- ⚠️ 기존 마이그레이션은 수정하지 않는다 — 제약을 drop/재생성만 한다.

begin;

alter table team_members add column if not exists leave_on date;
comment on column team_members.leave_on is '퇴사 예정일. 대표가 합의 결과를 기재한다. 지나면 대표가 대신 이관.';

-- status 에 'leaving'(퇴사 예정) 추가 — 기존 team_members_status_check 확장
alter table team_members drop constraint if exists team_members_status_check;
alter table team_members add constraint team_members_status_check
  check (status in ('invited', 'active', 'inactive', 'leaving'));

-- 이관 이력 — 캠페인/대화가 누구에게서 누구로 옮겨졌는지. 인수인계 메모 포함.
create table if not exists transfers (
  id uuid primary key default gen_random_uuid(),
  from_id uuid not null references profiles(id),
  to_id uuid not null references profiles(id),
  kind text not null check (kind in ('campaign','conversation')),
  ref_id uuid not null,        -- campaign_id 또는 conversation_id
  memo text,                   -- 인수인계 메모(사람이 남기는 것)
  by_id uuid not null references profiles(id), -- 이관을 실행한 사람
  at timestamptz not null default now()
);
create index if not exists transfers_to_idx on transfers (to_id, at desc);

alter table transfers enable row level security;

-- 이관 당사자(주는 사람·받는 사람·실행자)만 읽고, 실행자만 기록한다.
drop policy if exists transfers_read on transfers;
create policy transfers_read on transfers for select using (
  auth.uid() = from_id or auth.uid() = to_id or auth.uid() = by_id
);
drop policy if exists transfers_insert on transfers;
create policy transfers_insert on transfers for insert with check (
  auth.uid() = by_id
);

-- 대화 담당자 재배정(conversations.manager_id)은 conversations RLS(SELECT 정책만) 때문에
-- 클라이언트 UPDATE 가 막힌다. 이관 서버 액션(transfers.ts)에서 회사 소속을 코드로 확인한 뒤
-- service-role 클라이언트로 처리한다(campaignMessage.ts 와 동일한 방식). 별도 DB 함수는 두지 않는다.

commit;
