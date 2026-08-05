# DB 마이그레이션 (matchpost)

모든 스키마 변경(테이블/컬럼/인덱스/RLS)을 **번호 붙은 SQL 파일**로 이 폴더에 남기고 **git 커밋**한다.
→ Supabase든 별도 Postgres 서버든, 순서대로 재생(replay)하면 동일 스키마가 복원된다.

## 규칙
- 파일명: `NNNN_설명.sql` (`0001_`, `0002_` … 4자리 순번, 겹치지 않게)
- **한 번 커밋한 마이그레이션은 수정 금지** (이미 실행됐을 수 있음). 바꿀 게 있으면 새 번호로 추가.
- 모든 DDL은 가능하면 `if not exists` / `if exists` 로 **재실행 안전(idempotent)** 하게 작성.
- 실행 방법(현재): Supabase Dashboard → SQL Editor에 붙여넣어 실행. 실행하면 파일 상단에 적용일 메모.

## ⚠️ 베이스라인 미포함
`0001` 이전의 초기 스키마(캠페인/제안/프로필/메시지 등)는 마이그레이션 추적 이전에
Supabase에서 직접 생성되어 **이 폴더에 없다.** 완전한 재생을 하려면 초기 스키마 스냅샷이 필요하다.
- 확보 방법: Supabase CLI `supabase db pull` 또는 Dashboard의 스키마 export →
  `0000_baseline.sql` 로 저장해 채워 넣을 것. (별도 DB 서버 이전 전에는 반드시 확보)

## 목록
- `0001_campaigns_dealsheet_fields.sql` — 캠페인 채널/구분/옵션/다중날짜/총예산 컬럼
- `0002_campaigns_content_counts.sql` — 채널별 의뢰 콘텐츠 수량
- `0003_campaigns_manuscript_deadline.sql` — 원고 마감일 + 추가 전달내용
- `0004_campaigns_payment.sql` — 결제 예정일 + 결제방식
- `0005_campaigns_recruit_schedule.sql` — 참여 인플루언서 모집일정(신청기간·발표·콘텐츠등록기간·모집인원). manuscript_deadline* 대체·미사용
- `0006_campaigns_location.sql` — 장소 상세(장소명·주소). 네이버 지역검색 자동입력
- `0007_campaigns_missions.sql` — 채널별 미션(세부 요구조건)
- `0008_campaign_detail_templates.sql` — 상세 내용 저장 양식(광고주별, 신규 테이블 + RLS)
- `0009_campaigns_guide_file.sql` — 가이드 파일 업로드(컬럼 + campaign-guides 버킷)
- `0010_schedules_open_detail.sql` — 오픈 상세(채널·희망페이·메모) 컬럼
- `0011_campaigns_images.sql` — 캠페인 이미지(image_urls·cover_image_url) 컬럼 + Storage 버킷
- `0012_dealsheet.sql` — 딜시트: proposals 진행단계 8개 컬럼 + campaigns 일정 3개 컬럼
- `0013_credits.sql` — (0018에서 완전 교체됨) 크레딧 잔액 캐시 컬럼 + 트리거
- `0014_reviews.sql` — 상호 리뷰(reviews) + 블라인드 공개 트리거 + match_score 집계
- `0015_blog_analytics.sql` — 블로그 크롤링 지표(blog_analytics)
- `0016_blog_keyword_rankings.sql` — blog_analytics 키워드 노출 순위 컬럼
- `0017_blog_post_rankings.sql` — blog_analytics 포스팅 단위 키워드 노출 + 등급
- `0018_credit_ledger.sql` — 크레딧 원장(credit_ledger, append-only) + user_visit_log + 잔액뷰 + charge/grant/refund/penalty/decay 함수. 0013 완전 대체(잔액은 이관 후 구 테이블 제거)
- `0019_schedules_open_group.sql` — schedules.open_group_id 추가. 오픈 1건이 여러 날짜(행)로 나뉘어도 그룹의 첫 행에서만 크레딧 차감·지급되도록 0018의 오픈 트리거 함수 교체
- `0020`~`0033` — (IMPLEMENT-3/4) proposals.initiated_by, celebrate 중복방지, schedules.date_end, settle 스키마/함수, paid_confirm_attempts, reports, sanctions, cancellations, proposals schedule_slot, connections, messages.checkpoint_kind, contact_fields, blog_score_version. 상세는 각 파일 참고
- `0034_append_only_guards.sql` — credit_ledger UPDATE/DELETE 트리거로 차단(append-only를 DB 레벨에서 강제)
- `0035_reviews_lock_individual.sql` — reviews_select를 reviewer_id 본인만으로 좁힘(개별 리뷰는 본인 포함 아무에게도 비공개) + admin select 정책
- `0036_campaign_payment_terms.sql` — campaigns.payment_term_type/payment_term_value 추가(예정일 직접입력 대신 규칙으로 받음)
- `0037_payment_due_changes.sql` — 결제 예정일 변경 이력(append-only) 테이블
- `0038_tax_consent_tables.sql` — tax_consents/tax_export_log(admin만 SELECT)
- `0039_visit_tracking.sql` — profiles.last_visited_at 추가
- `0040_checkpoint_due_dates.sql` — resolve_payment_due_date() + trg_fn_create_checkpoints/settle_campaign 갱신(체크포인트 마감일 자동 채움 + 결제예정일 자동확정)
- `0041_trust_score_cache.sql` — trust_score를 VIEW→TABLE로 전환 + refresh_trust_score() 배치 갱신 함수
- `0042_batch_functions.sql` — run_dormant_decay_batch/run_payment_reminder_batch/run_visit_weekly_batch/run_visit_monthly_batch (크론 연결은 다음 차수)
- `0043_perf_indexes.sql` — proposals(campaign_id,stage) / schedules(influencer_id,date) / notifications(user_id,state) 인덱스
- `0044_reviews_rename_to_spec.sql` — reviews 컬럼명을 IMPLEMENT-2-SETTLE.md 스펙에 맞춤(rater_id/ratee_id/role/stars/private_note) + closed_at 추가, 트리거·refresh_trust_score() 컬럼 참조 갱신
- `0045_notifications_done_state.sql` — notifications.state CHECK 제약 추가 + "행위로만 done" 배선(평가 제출 시 본인 review 그룹 done, 정산 등록 시 payment_reminder done) + 관련 인덱스 3개
- `0046_settle_campaign_security.sql` — settle_campaign() EXECUTE 권한을 service_role로만 제한(anon 키로 다른 SECURITY DEFINER 함수 직접 호출되는 것 확인해서 잠금). 호출자 소유권 확인은 src/lib/deals/settle.ts에서 선행
