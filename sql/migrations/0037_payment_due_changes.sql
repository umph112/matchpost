-- 0037  결제 예정일 변경 이력 — 변경 자체가 아니라 "말없이 미루는 것"을 문제 삼기 위한 흔적
-- IMPLEMENT-1-SCHEMA.md §2. deals 테이블이 없어 proposal_id로 매핑(0023과 동일 컨벤션).
-- 이번 차수는 스키마만 — 쓰는 코드(변경 UI/알림)는 다음 차수.

begin;

create table if not exists payment_due_changes (
  id                  uuid primary key default gen_random_uuid(),
  proposal_id         uuid not null references proposals(id) on delete cascade,
  from_date           date,
  to_date             date,
  reason              text,
  changed_at          timestamptz not null default now(),
  changed_by          uuid references auth.users(id),
  acked_by_influencer boolean not null default false,
  acked_at            timestamptz
);

create index if not exists payment_due_changes_proposal_idx on payment_due_changes(proposal_id);

alter table payment_due_changes enable row level security;

drop policy if exists "payment_due_changes_select" on payment_due_changes;
create policy "payment_due_changes_select" on payment_due_changes
  for select using (
    exists (
      select 1 from proposals p
      where p.id = proposal_id
        and (auth.uid() = p.advertiser_id or auth.uid() = p.influencer_id)
    )
    or exists (select 1 from profiles where id = auth.uid() and is_admin = true)
  );

-- append-only: 행 자체는 수정 불가(acked_by_influencer/acked_at 갱신은 별도 함수로 다음 차수에 추가 예정이며,
-- 그때도 이 UPDATE 자체를 여는 대신 "확인" 이벤트를 새 컬럼이 아닌 새 행으로 남기지 않고 갱신해야 하는
-- 유일한 예외 컬럼이라 트리거는 지금은 전체 UPDATE/DELETE를 막아둔다 — 확인 플로우 설계 시 재검토)
create or replace function trg_fn_payment_due_changes_append_only()
returns trigger language plpgsql as $$
begin
  raise exception 'payment_due_changes is append-only' using errcode = 'P0001';
end;
$$;

drop trigger if exists trg_payment_due_changes_no_update on payment_due_changes;
create trigger trg_payment_due_changes_no_update
  before update on payment_due_changes
  for each row execute function trg_fn_payment_due_changes_append_only();

drop trigger if exists trg_payment_due_changes_no_delete on payment_due_changes;
create trigger trg_payment_due_changes_no_delete
  before delete on payment_due_changes
  for each row execute function trg_fn_payment_due_changes_append_only();

commit;
