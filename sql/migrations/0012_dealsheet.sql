-- 0012  딜시트 — proposals 진행 단계 + campaigns 일정 컬럼
-- 관련: src/app/(dashboard)/advertiser/campaigns/[id]/page.tsx (딜시트 뷰)
-- 8단계: 신청 → 확정 → 가이드 → 방문 → 업로드 → 수정/컴프 → 검사 → 정산
-- 지역 캠페인: 8단계 전체 / 제품·기자단: 방문 제외 7단계 (visit_at 미사용)

-- ── proposals 추가 컬럼 ────────────────────────────────────
alter table proposals
  add column if not exists stage              text default '신청',        -- 현재 진행 단계
  add column if not exists visit_at           timestamptz,                -- 방문 일시 (지역 캠페인)
  add column if not exists visit_confirmed    boolean     default false,
  add column if not exists upload_url         text,                       -- 업로드 콘텐츠 URL
  add column if not exists inspection_url     text,                       -- 검사 링크
  add column if not exists inspection_at      date,                       -- 검사 완료일
  add column if not exists inspection_status  text        default '검토중', -- 통과 / 미통과 / 검토중
  add column if not exists tax_doc_type       text,                       -- 세금계산서 / 3.3%
  add column if not exists tax_doc_received   boolean     default false,
  add column if not exists settlement_status  text        default '미정산',  -- 미정산 / 정산중 / 완료
  add column if not exists performance_metrics jsonb;                     -- {views,likes,comments,saves}

-- ── campaigns 추가 컬럼 ───────────────────────────────────
alter table campaigns
  add column if not exists upload_deadline    date,
  add column if not exists inspection_deadline date,
  add column if not exists settlement_date    date;
