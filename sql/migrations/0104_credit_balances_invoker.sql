-- 0104  잔액 뷰 — security_invoker
--
-- credit_balances(0018:105)는 credit_ledger 를 합산한 뷰다.
-- 뷰는 기본적으로 「만든 사람」 자격으로 밑의 테이블을 읽으므로,
-- 원장에 auth.uid() = user_id 정책(0018:41)이 걸려 있어도 뷰를 거치면 무력해졌다.
-- 로그인만 하면 누구든 전 회원의 잔액을 조회할 수 있었다.
--
-- invoker 로 바꾸면 「읽는 사람」 자격이 되어 원장 정책이 그대로 걸린다.
--
-- 이 뷰를 읽는 곳은 셋이고, 앞의 둘은 영향이 없다:
--   api/credits/balance/route.ts:9  서버 RLS · user_id = 내 id      → 그대로
--   lib/credits/ledger.ts:23        service(RLS 우회)               → 그대로
--   admin/credits/page.tsx          브라우저에서 전 회원 조회        → 끊긴다
-- 그래서 마지막 하나를 먼저 api/admin/credits/route.ts(관리자 확인 후 service)로
-- 옮긴 뒤에 이 마이그레이션을 적용했다. 순서를 지키면 끊기는 구간이 없다.
--
-- 확인(2026-08-26): 인플루언서 전체 조회 28행 → 1행, 본인 잔액 16,500C 그대로.
-- 관리자 화면 목록 36장·이력 표시 그대로.

begin;

alter view credit_balances set (security_invoker = on);

commit;
