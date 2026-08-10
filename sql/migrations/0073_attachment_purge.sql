-- D6 F3 — 대시 첨부파일 7일 자동삭제. 실제 파일 삭제는 API 라우트(storage)에서 하고,
-- 이 컬럼은 "언제 지워졌는지"만 기록해 대화 기록(파일명/시각/보낸사람)은 그대로 남긴다.
alter table messages add column if not exists file_deleted_at timestamptz;

create index if not exists idx_messages_file_purge
  on messages (created_at)
  where file_url is not null and file_deleted_at is null;
