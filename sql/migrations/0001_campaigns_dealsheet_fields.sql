-- 0001  캠페인 등록 개편: 딜시트 기반 캠페인 내역 컬럼 추가
-- 적용: 2026-07-27 (Supabase SQL Editor에서 실행 완료)
-- 관련: src/app/(dashboard)/advertiser/campaigns/new/page.tsx

alter table campaigns
  add column if not exists channels      text[] default '{}',   -- 블로그/유튜브/인스타그램/틱톡 (복수)
  add column if not exists campaign_type  text,                  -- 제품 / 지역 / 기자단
  add column if not exists options        jsonb  default '[]',   -- [{type:'구매평', cost:30000}, ...]
  add column if not exists dates          jsonb  default '[]',   -- [{date, start_time, end_time}, ...] 최대 30
  add column if not exists budget_total    bigint;               -- 세금 포함 총 예산 (원 단위). 만원 입력값 × 10000

-- 기존 date/start_time/end_time 컬럼은 그대로 사용 (첫 날짜 값으로 채워 달력 매칭 하위호환)
-- TODO(수수료): 향후 캠페인별 플랫폼 이용 수수료 도입 시 budget_total에 포함 + 딜시트 표기
