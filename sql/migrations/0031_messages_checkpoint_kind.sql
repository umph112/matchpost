-- ⑦ 대시 파일 — 대화 체크포인트
-- 파일 첨부 시 '가이드로 등록' 체크 여부를 메시지에 기록
alter table messages
  add column if not exists checkpoint_kind text
    check (checkpoint_kind in ('guide', null));
