-- 0039  방문 추적 — profiles.last_visited_at
-- user_visit_log는 0018에서 이미 생성됐으나 쓰는 코드가 없었다(확인 완료).
-- 이번 차수에서 src/lib/visits/track.ts가 실제로 두 테이블을 함께 갱신한다.

begin;

alter table profiles
  add column if not exists last_visited_at timestamptz;

commit;
