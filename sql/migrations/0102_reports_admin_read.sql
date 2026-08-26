-- 0102  신고 — 관리자 읽기 정책
--
-- 0026 에서 UPDATE(43행)에는 관리자 조건을 넣었는데 SELECT(33행)에는 빠져 있었다.
-- 관리자는 신고를 「닫을 권한은 있는데 볼 권한이 없는」 상태였고,
-- 그래서 관리자 화면들이 service 키로 우회해 읽고 있었다(0102 이후 그 우회를 걷어냈다 —
-- admin/dashboard/page.tsx · lib/admin/todayQueue.ts).
--
-- PERMISSIVE 정책은 OR 로 합쳐지므로 이 정책을 더해도 기존 접근은 좁아지지 않는다.
--
-- 확인(2026-08-26): service 1건 / 관리자 1건 / 피신고 당사자 1건 / 무관한 제3자 0건.
-- 화면으로도 /admin/dashboard · /admin/reports · /admin/reports/[id] 세 곳 열림 확인.

begin;

drop policy if exists "reports: read admin" on reports;
create policy "reports: read admin"
  on reports
  for select
  to authenticated
  using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

commit;
