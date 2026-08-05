-- 0047  settle_campaign(0046)과 같은 문제를 가진 나머지 SECURITY DEFINER 함수 잠금
--
-- 전부 돈(credit_ledger_*)이나 지표/배치를 직접 움직이는 함수라 anon/authenticated가
-- 직접 호출할 이유가 없다. 이 프로젝트 TS 코드에서의 실제 호출부를 전부 확인했고
-- (src/lib/credits/ledger.ts, src/app/api/admin/batch/*, requireAdmin.ts) 전부
-- service-role 클라이언트로만 호출한다 — 잠가도 앱 동작에는 영향 없음.
-- resolve_payment_due_date는 TS에서 직접 호출되는 곳이 없고 trg_fn_create_checkpoints·
-- settle_campaign 내부에서만 쓰인다 — SECURITY DEFINER 함수 내부의 호출은 PostgREST
-- 역할 권한 체크를 거치지 않으므로 잠가도 그 경로엔 영향 없다.

begin;

revoke execute on function credit_ledger_charge(uuid, int, text, text, uuid, text, text) from public, anon, authenticated;
grant  execute on function credit_ledger_charge(uuid, int, text, text, uuid, text, text) to service_role;

revoke execute on function credit_ledger_grant(uuid, int, text, text, text, uuid, text, uuid) from public, anon, authenticated;
grant  execute on function credit_ledger_grant(uuid, int, text, text, text, uuid, text, uuid) to service_role;

revoke execute on function credit_ledger_refund(uuid, int, text, text, uuid, text) from public, anon, authenticated;
grant  execute on function credit_ledger_refund(uuid, int, text, text, uuid, text) to service_role;

revoke execute on function credit_ledger_penalty(uuid, int, text, text, uuid, text) from public, anon, authenticated;
grant  execute on function credit_ledger_penalty(uuid, int, text, text, uuid, text) to service_role;

revoke execute on function credit_ledger_decay(uuid, text, int) from public, anon, authenticated;
grant  execute on function credit_ledger_decay(uuid, text, int) to service_role;

revoke execute on function run_dormant_decay_batch() from public, anon, authenticated;
grant  execute on function run_dormant_decay_batch() to service_role;

revoke execute on function run_payment_reminder_batch() from public, anon, authenticated;
grant  execute on function run_payment_reminder_batch() to service_role;

revoke execute on function run_visit_weekly_batch() from public, anon, authenticated;
grant  execute on function run_visit_weekly_batch() to service_role;

revoke execute on function run_visit_monthly_batch() from public, anon, authenticated;
grant  execute on function run_visit_monthly_batch() to service_role;

revoke execute on function refresh_trust_score() from public, anon, authenticated;
grant  execute on function refresh_trust_score() to service_role;

revoke execute on function resolve_payment_due_date(text, int, date, date) from public, anon, authenticated;
grant  execute on function resolve_payment_due_date(text, int, date, date) to service_role;

commit;
