-- 0034  append-only 강제 — credit_ledger
-- RLS만으로는 service_role이 우회 가능(BYPASSRLS)하므로, DB 레벨 트리거로
-- UPDATE/DELETE 자체를 차단한다. 0023의 trg_fn_proposals_settled_immutable과 동일 패턴.
-- (audit_log 테이블은 이 프로젝트에 존재하지 않아 대상에서 제외)

begin;

create or replace function trg_fn_credit_ledger_append_only()
returns trigger language plpgsql as $$
begin
  raise exception 'credit_ledger is append-only — insert a reversing row instead' using errcode = 'P0001';
end;
$$;

drop trigger if exists trg_credit_ledger_no_update on credit_ledger;
create trigger trg_credit_ledger_no_update
  before update on credit_ledger
  for each row execute function trg_fn_credit_ledger_append_only();

drop trigger if exists trg_credit_ledger_no_delete on credit_ledger;
create trigger trg_credit_ledger_no_delete
  before delete on credit_ledger
  for each row execute function trg_fn_credit_ledger_append_only();

commit;
