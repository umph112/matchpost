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
- `0047_lock_privileged_functions.sql` — credit_ledger_* 5종, run_dormant_decay_batch/run_payment_reminder_batch/run_visit_weekly_batch/run_visit_monthly_batch, refresh_trust_score, resolve_payment_due_date — 0046과 같은 이유로 EXECUTE를 service_role로만 제한
- `0048_re_settle_campaign.sql` — 재정산 루프 제대로 구현. settlement_attempts(0025, 그동안 미사용)를 실제로 써서 회차 기록, settled_at은 절대 안 건드림, payment 체크포인트를 "신고 없이 확정된 날" 기준으로 재계산, 3회째부터 운영팀 에스컬레이션 알림. 0046/0047과 같은 이유로 EXECUTE 잠금
- `0049_blog_history_tables.sql` — blog_analytics_history / blog_post_rankings 테이블 신설(IMPLEMENT-3-SCREENS.md 10장 ⑤⑥) + blog_analytics.missing_metrics/grade_score 컬럼 추가
- `0050_admin_role_unify_and_blog_history.sql` — 관리자 판정을 profiles.role='admin'으로 통일(is_admin은 한 번도 true였던 적 없는 죽은 컬럼이었음을 실측 확인). RLS 4건(reviews/payment_due_changes/tax_consents/tax_export_log/trust_score) + re_settle_campaign 에스컬레이션 대상 교체. blog_score_history(0033)는 폐기, blog_analytics_history를 정본으로 확정 + score_version 컬럼 추가
- `0051_reports_functions.sql` — 신고(reports) 접수/해결/재오픈/관리자종결·이관 + 14일 자동종결·7일 리마인드 배치. file_report()가 서버에서 counterpart_id·stage·snapshot 직접 유도
- `0052_sanctions_recalc.sql` — 제재(sanctions) 자동 산정 배치. 결제 지연 "비율" 기준 0~3단계만 자동(4·5단계는 수동판단 영역이라 배치가 안 건드림), 해제는 미해결신고 없음 + 최근 3건 연속 정시일 때만
- `0053_cancellations_functions.sql` — 취소(cancellations) 요청/수락 + 3일 자동확정·90일 카운트리셋 배치. settlement_attempts처럼 그동안 미사용이던 이력 스키마를 실사용으로 전환
- `0054_proposal_time_overlap.sql` — 협업 시간 설정(set_proposal_time) + 겹침 체크. proposals.start_at/duration_min(0029, 그동안 미사용) 실사용, 확정 최종 관문(/api/deal/confirm)에서 재검사
- `0055_connections_functions.sql` — 상호등록(connections) 제안/수락/해제. 실제 정산 완료한 사이만 제안 가능(스팸 방지)
- `0056_message_checkpoint_trigger.sql` — messages.checkpoint_kind(0031, 'guide'만 허용하던 제약)를 guide/draft/publish로 확장 + 대화 파일 전송 시 딜시트 체크포인트 자동완료 트리거
- `0057_dash_fee_beta_free.sql` — 대시 발송 과금(500C, 문서엔 100C로 적혀 있었으나 실제 운영값은 500C) 베타 기간 한시 중단. 트리거 삭제 대신 함수 내부 조건(v_dash_fee_enabled)으로 꺼서 재개 용이
- `0058_send_dash.sql` — 대시 보내기 통합(IMPLEMENT-5-DELTA.md A3/A4). 지금까지 갈라져 있던 두 발송 경로(전체 폼은 대화를 안 열고, 캘린더/검색 버튼은 proposals 행을 안 만듦)를 send_dash() 하나로 합침. 같은 상대+같은 캠페인/오픈에 미확정 proposals 행이 있으면 새로 안 만들고 그 행을 갱신 + 재전송 시스템 메시지·알림으로 분기
- `0059_cancellation_withdraw.sql` — 취소 요청 철회(IMPLEMENT-5-DELTA.md A6). 0053에 요청/수락만 있고 요청자 본인이 철회하는 경로가 빠져 있었음. agreed=null인 pending row를 삭제(카운트는 되돌리지 않음)
- `0060_settlements_screen.sql` — 정산 화면(/advertiser/settlements) 지원(IMPLEMENT-5-DELTA.md B절, SPEC-B-SETTLE.md 화면11). campaigns.tax_doc_requested_at + 범용 audit_log 테이블 + request_tax_docs()/resolve_settlement_dispute() RPC. SettleConfirmModal도 "미수령 제외하고 부분 기록" 방식을 없애고 전원 수령 전엔 잠그도록 수정
- `0061_credit_review_comeback.sql` — 크레딧 정책 중 빠져 있던 훅 2개: review(리뷰 작성 1,000C, 종료 후 7일 이내) 트리거 + comeback(30일 공백 후 복귀 1,000C) 배치. 나머지 크레딧 규칙은 0018/0024/0042에 이미 구현돼 있었음(creditConfig.ts가 SPEC과 이미 일치)
- `0062_advertiser_payment_score.sql` — 정산 성실도(광고주 신뢰 지표) 뷰. 인플루언서 귀책 제외는 draft/publish 체크포인트 지연 여부로 근사(정밀 판정 필드 없음 — GAPS-FOR-NEXT-ROUND.md 참고)
- `0063_team_members.sql` — 팀 초대(IMPLEMENT-5-DELTA.md C2). `team_members` 테이블(초대/역할/상태) + `invite_team_member()` RPC(이메일 교차조회는 user_private RLS 때문에 SECURITY DEFINER 필요). 역할변경/재발송/재활성화는 RLS(owner_id=auth.uid())로 충분해 별도 RPC 없음. 실제 팀원의 오너 데이터 접근 권한 전파는 범위 밖(GAPS-FOR-NEXT-ROUND.md 0번 참고)
- `0064_credit_profile_first_action.sql` — 크레딧 훅 2개 추가: profile_complete(프로필 완성 3,000C), first_action(첫 행동 3,000C)
- `0065_conversations.sql` — (IMPLEMENT-6-DELTA.md A1) `conversations` 테이블(캠페인룸/개인룸) + `get_or_create_conversation()` RPC + messages.broadcast_id/targeted_only/is_system/proxy/proposed_date + proposals.proposed_date/proposed_by 컬럼
- `0066_dash_date_and_messaging.sql` — (A6/A7) send_dash()에 날짜 파라미터 필수화(p_date, 없으면 P0018) + 날짜제안 메시지카드 생성 + accept_date_proposal() RPC + send_campaign_message()(캠페인룸 전체/개별 발송) RPC
- `0067_cancellation_propagation.sql` — (A8) accept_cancellation()이 취소 수락 시 proposals.advertiser_confirmed/influencer_confirmed를 false로 같이 내려서, 취소된 건이 앱 전체(캠페인목록·대시보드·정산·딜시트)의 "확정 건" 집계에서 자동으로 빠지게 함
- `0068_campaign_stages.sql` — (B1/B3) campaigns.stage_pre_confirm/stage_post_edit/first_confirmed_at 추가 + 첫 확정 시각 자동기록 트리거 + 기존 단계명 데이터 이관(신청→협의, 확정→수락, 업로드→원고, 수정/컴프→수정/컨펌, 검사→게재)
- `0069_cancellation_stage_names.sql` — 0068의 단계명 변경 이후 request_cancellation()(0053)에 남아있던 옛 8단계 배열 하드코딩을 새 9단계 배열로 수정(방치 시 "게재 후엔 취소 불가" 검사가 조용히 깨짐)
- `0070_campaign_stage_lock.sql` — (B4) campaigns.stage_pre_confirm/stage_post_edit는 first_confirmed_at 확정 이후 변경 시 트리거가 P0021로 차단(진행 중 캠페인의 단계 구성이 바뀌는 것 방지)
- `0071_settlement_overdue_reminder.sql` — (C1/C6) campaigns.overdue_reminder_count 추가 + run_settlement_reminder_batch()(정산일 지난 미확정 건에 알림+대화 시스템메시지, 3회째부터 운영팀 언급 문구로 확대)
- `0072_credit_policy_changes.sql` — (D1 관련 E1) credit_policy_changes 테이블(크레딧 금액 변경 예고 기록, admin 전용). 실제 금액은 여전히 creditConfig.ts가 원본 — 여긴 공지 이력만 기록
- `0073_attachment_purge.sql` — (F3) messages.file_deleted_at 추가 + 인덱스. 대시 첨부파일 7일 자동삭제 크론(`/api/cron/purge-attachments`)이 실제 파일만 지우고 이 컬럼을 채움 — 파일명/시각/보낸사람은 대화 기록에 그대로 남음
