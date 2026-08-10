-- 0072  크레딧 정책 변경 이력 — D6 D5/E1
--
-- 실제 지급/차감 값은 src/lib/creditConfig.ts(코드 배포로만 바뀜, D1 원문 그대로 정적 배열).
-- 이 테이블은 "언제 무엇을 얼마로 바꾸기로 했는지"의 공지 기록이다 — 30일 전 공지 + 유예 원칙의
-- 종이 흔적. 실제 값 반영은 코드 배포 시점에 별도로 한다(자동 적용 아님).

begin;

create table if not exists credit_policy_changes (
  id           uuid primary key default gen_random_uuid(),
  key          text not null,
  old_amount   int,
  new_amount   int not null,
  announced_at date not null,
  effective_at date not null,
  note         text,
  created_by   uuid references profiles(id),
  created_at   timestamptz not null default now()
);

alter table credit_policy_changes enable row level security;

drop policy if exists "admin manages policy changes" on credit_policy_changes;
create policy "admin manages policy changes" on credit_policy_changes
  for all using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));

commit;
