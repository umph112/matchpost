-- 0035  개별 리뷰는 아무에게도(본인 포함) 노출하지 않는다 — 집계(match_score/trust_score)만 공개
-- 기존 reviews_select 정책은 is_revealed=true 이후 reviewee가 개별 행을 직접 SELECT 할 수 있었으나,
-- 프런트 어디에서도 그 경로를 실제로 쓰지 않는 것을 확인(DealSheet.tsx는 reviewer_id=본인만 조회,
-- ReviewModal은 insert 전용) — DB 정책만 좁혀도 회귀 없음.
-- is_revealed 컬럼/트리거(trg_reveal_reviews, trg_update_match_score)는 유지 —
-- 양쪽 제출 전에는 집계(match_score)에 조기 반영되지 않도록 막는 용도로 계속 필요.

begin;

drop policy if exists "reviews_select" on reviews;
create policy "reviews_select" on reviews
  for select using (auth.uid() = reviewer_id);

drop policy if exists "reviews_select_admin" on reviews;
create policy "reviews_select_admin" on reviews
  for select using (
    exists (select 1 from profiles where id = auth.uid() and is_admin = true)
  );

commit;
