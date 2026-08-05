-- 0046  settle_campaign 실행 권한 잠금
--
-- 점검 중 실제로 확인된 문제: 이 프로젝트의 SECURITY DEFINER 함수들은 생성 시 실행권한을
-- 명시적으로 제한한 적이 없어, Supabase 기본값대로 anon/authenticated에 EXECUTE가 열려 있다.
-- resolve_payment_due_date를 anon 키로 직접 RPC 호출해 실제로 재현 확인함(200 OK).
-- settle_campaign은 이 문서(IMPLEMENT-2-SETTLE)의 핵심 함수라 지금 잠근다.
-- credit_ledger_*·배치 함수 5종·refresh_trust_score 등 다른 문서에서 만든 함수들도
-- 같은 문제가 있으나, 범위 밖이라 이번엔 건드리지 않는다(별도 후속 작업으로 남겨둠).
--
-- 호출자 신원 확인 자체는 여기서 할 수 없다 — settle_campaign은 service-role 경로로만
-- 호출되도록 잠그고(auth.uid()가 없는 경로), 실제 advertiser_id 소유권 확인은
-- src/lib/deals/settle.ts에서 요청자 세션 기준으로 먼저 검증한 뒤에만 이 함수를 호출한다.

begin;

revoke execute on function settle_campaign(uuid, text, bool, int, int, int) from public;
revoke execute on function settle_campaign(uuid, text, bool, int, int, int) from anon;
revoke execute on function settle_campaign(uuid, text, bool, int, int, int) from authenticated;
grant execute on function settle_campaign(uuid, text, bool, int, int, int) to service_role;

commit;
