# MatchPost — 프로젝트 핸드오프 / 현황

> 이 문서는 기기 이동(데스크탑↔노트북) 시 맥락을 이어주기 위한 것. Claude가 세션 시작 시 읽고 현황을 파악한다.
> 작업 종료 시 갱신한다.

## 버전 · 진행 (테스트 2.0 완료)
- 버전 체계: **테스트 → 베타 → 정식**. 현재 = **테스트 2.0 완료**.
- **광고주 마이페이지 PC 대시보드** 구현 완료 (디자인 핸드오프 `design/mypage-pc/README.md` 기준).
  - ✅ STEP 1 셸(사이드바·상단바, lucide, Pretendard)
  - ✅ STEP 2 본문 레이아웃(헤더·KPI 4카드·2단 그리드)
  - ✅ STEP 3 최근 캠페인 표
  - ✅ STEP 4 커스텀 캘린더(CampaignCalendar) + byDay 데이터 + 마이그레이션 0010
  - ✅ STEP 5 날짜 팝업(목록→상세) — 캠페인/오픈 상세, "이 날짜로 대시 보내기" 버튼
  - ✅ STEP 6 "이 날짜로 대시 보내기" → `/advertiser/messages?to=&date=` 프리필 연결
  - ✅ 모바일 깨짐 1차 수정(헤더 세로배치·최근캠페인 표 가로스크롤)
  - ✅ AdvertiserShell 기본값 — UA 기반 모바일 판별(화면 너비 자동감지 제거), 새 기기도 PC 모드 기본
- ✅ **캠페인 이미지** — 등록 폼 최대 5장 업로드, 대표사진 선택, 상세페이지 앨범 표시 (migration 0011)
- 마이그레이션 0010·0011은 실행 완료(2026-08-10 DB 대조 확인). **⚠️ Storage `campaign-images` 버킷(Public)은 아직 생성 안 됨** — 캠페인 이미지 업로드가 버킷 단계에서 실패 가능. **⚠️ Vercel env에 네이버 키(NAVER_API_CLIENT_ID/SECRET) 미등록**(로컬엔 있음, 배포판 장소검색·오픈 조인 영향). 상세는 `docs/REPO-STATUS-CHECK.md`.
- ✅ **크레딧 원장(credit_ledger)** — `IMPLEMENT-1-SCHEMA.md` 1번 항목 스키마·서버 액션 구현 완료(화면 없음). `sql/migrations/0018_credit_ledger.sql`: append-only 원장(`credit_ledger`, wallet free/paid, reason_code) + `credit_balances` 뷰(잔액은 합계로만 파생, 캐시 컬럼 없음) + `credit_ledger_charge/grant/refund/penalty/decay` 함수 + 이벤트 트리거 4개(캠페인생성/오픈등록/대시발송/양쪽확정). **기존 0013_credits.sql(잔액 캐시+트리거) 완전 교체** — 잔액은 `kind='admin', reason_code='migration'` 행으로 이관 후 구 테이블 삭제. `src/lib/credits/ledger.ts`(TS 서버 액션 레이어), `src/lib/creditConfig.ts` 갱신. 기존 3개 API(`signup`, `credits/balance`, `credits/admin-grant`)와 `admin/credits` 화면 쿼리도 새 스키마로 이관(화면 UI는 무변경). 가입 환영 크레딧이 기존 10만/5만 → **양쪽 30,000으로 변경**됨.
  - 마이그레이션 0018·0019 실행 완료(2026-08-10 DB 대조 확인 — 구 `credits`/`credit_transactions` 테이블이 없는 것 자체가 0018이 돌았다는 증거).
  - `0019_schedules_open_group.sql` — `schedules.open_group_id` 추가. "오픈 1건=1,000C, 날짜 수 무관" 정책을 지키기 위해 같은 그룹의 첫 행에서만 차감·응원 지급하도록 오픈 트리거 함수 교체. 현재 인플루언서 오픈 등록 폼(`influencer/schedule/page.tsx`)은 한 번에 한 날짜만 insert하므로 즉시 동작에 영향 없음(각 행이 default로 자기 자신만의 group_id를 받음) — 나중에 오픈 등록이 여러 날짜를 한 번에 묶어 넣는 폼으로 바뀌면 그 삽입 코드가 여러 행에 **같은 open_group_id를 명시적으로 넘겨야** 이 정책이 실제로 작동한다.
  - 이번 차수에서 훅을 안 붙인 reason_code(다음 차수에서 연결): `unlock_profile`(프로필 유료열람 기능 자체 미구현), `deal_complete`(정산 흐름 `settleCampaign` — 지시서 8번), `review`/`invite` 보상, `visit_weekly`/`visit_monthly`/`comeback`/휴면배치(크론 인프라 없음).

## 현재 상태 (2026-08-06 — D5 A절+B절(화면11/12·크레딧·정산성실도) 완료, 커밋 안 함)
- **디자인 핸드오프 5차(D5, delta)**: `docs/design/d5/`가 최신 기준 문서. 예전 라운드 문서는 전부 `design/_archive/`로 옮김(IMPLEMENT-1~4 포함). 남은 갭은 `docs/design/d5/GAPS-FOR-NEXT-ROUND.md`에 정리해둠 — 다음 핸드오프 받을 때 그 파일부터 확인할 것.
  - **A절(대시/메시지 상태 규칙, A1~A7) 완료** — A1 읽음 상태(`messages.is_read` 단일 파생), A3/A4 대시 보내기 통합(`sendDash`, `0058_send_dash.sql`, `?c=` 경로 통일), A5 조건수정 프리필, A6 취소요청 철회(`0059_cancellation_withdraw.sql`), A7 라벨 변경. A2(탭)는 탭 UI 자체가 없어서 원칙만 남기고 보류.
  - **화면11 정산 화면(B1~B4) 완료** — `/advertiser/settlements` 신규(`SettlementsView.tsx`). `SettleConfirmModal.tsx`가 "미수령 제외 부분기록"을 없애고 전원 수령 전엔 잠금 + "세무자료 N명 요청하기"로 전환. `0060_settlements_screen.sql`(tax_doc_requested_at, audit_log, request_tax_docs/resolve_settlement_dispute RPC).
  - **화면12 인플루언서 마이페이지 완료(대시보드 한정)** — `InfluencerShell.tsx` 신규(PC 사이드바+모바일 하단탭), `/influencer/dashboard`만 새 셸 적용(나머지 9개 페이지는 기존 TopBar 유지 — 사용자 확인 후 범위 축소). 답기다리는제안 배너·받은제안·진행중협업·7일스트립 추가.
  - **크레딧 정책 — 이미 구현된 게 대부분이었음**(creditConfig.ts가 SPEC과 이미 일치, 0018/0024/0042에 대부분 훅 연결됨). 빠졌던 review/comeback 훅만 추가(`0061_credit_review_comeback.sql`) + 유저용 화면 2개 신규(`/credits`, `/credits/about`). **대시 발송 500C는 베타 무료 유지로 확정**(0057 유지, SPEC 표와 다르게 감). invite(초대) 기능·unlock_profile 정의는 스펙 부족으로 보류 → 갭 문서 참고.
  - **정산 성실도 지표 완료** — `advertiser_payment_score` 뷰(`0062_advertiser_payment_score.sql`), 인플루언서 대시 받은제안 카드 + `/influencer/search` 카드에 정산 정시율 노출. 브랜드 정보 팝업·광고주 KPI 노출은 보류(갭 문서 참고).
  - **C절(그 밖의 작은 확정 C1~C4) 완료**:
    - C1 캠페인 목록 정렬 라벨 "등록 최신순/오래된순"(`MyCampaignsList.tsx`, 기존엔 진행일 기준인데 라벨이 모호했음)
    - C2 팀 초대 — `team_members` 테이블 + `/advertiser/team` 화면(초대/역할변경/재발송/재활성화) + 가입 시 이메일 자동연결. **단, 팀원이 실제로 오너의 캠페인·정산에 접근하는 권한 전파는 범위 밖**(15곳 이상 조회 지점을 건드려야 하는 별도 보안 작업 — `docs/design/d5/GAPS-FOR-NEXT-ROUND.md` 0번 참고)
    - C3 — 현재 레포에 "모바일에서 막혀야 할 되돌릴 수 없는 처리"가 없어서(모바일=반응형 재배치일 뿐 기능 잠금 없음) 원칙만 확인, 고칠 위반 사례 없었음
    - C4 오픈 등록 폼 플랫폼 선택을 단일→다중 토글로 전환(기존엔 select만 되고 insert에 빠져 있던 죽은 필드였음) + 내 오픈 목록 행이 대시 온 오픈만 대화로 연결(0건은 커서 없음)
  - **재확인 중 발견해서 추가로 고친 것**: 크레딧 "지급 8지점" 중 `profile_complete`/`first_action`이 실제로는 훅이 없었음(지난 요약에서 "이미 있다"고 잘못 말함) — `0064_credit_profile_first_action.sql`로 추가.
  - **재확인 후 사용자 확인받고 "지금 방식 유지"로 결정한 것 2개**(`docs/design/d5/DECISIONS-D5.md` "B/화면12 구현 후 재확인 결정" 참고): 정산 완료 기록이 캠페인 단위 트랜잭션 1건이 아니라 프로포절별 순회 호출인 점(정산 코드라 다시 안 건드림) / 화면12 모바일 홈에 스펙 8개 목록에 없는 내오픈목록·대시메시지·알림함 미리보기 3개를 그대로 남긴 점.
  - **Supabase SQL 0058~0064 전부 실행 완료** (2026-08-10 DB 직접 대조로 확인 — `docs/REPO-STATUS-CHECK.md` 참고)
  - `npx tsc --noEmit` + `npm run build` 매 단계마다 통과 확인됨. **D5 핸드오프(docs/design/d5/) 전체 항목 완료 — 남은 건 GAPS-FOR-NEXT-ROUND.md에 정리된, 스펙이 부족해 다음 라운드 확인이 필요한 것들뿐(초대 기능, 프로필 열람 잠금, 팀원 권한 전파, 관리자 지급 화면 고도화 등).**

## 🚨 최우선 원칙
- **MatchPost와 KPGTR(manian)은 완전히 별개의 앱/프로젝트다.** 코드·파일·DB를 섞지 않는다. 필요한 연동은 **API를 통한 느슨한 결합만** 허용(나중에 콘텐츠 등을 API로 주고받는 정도). 각자 독립 배포·운영.
- **수정 전 사전 보고 + 승인**: 어느 파일의 어느 부분을 어떻게 바꿀지 먼저 보고하고 승인 후 실행. 요청한 부분만, 최소 범위로.
- **커밋/푸시는 명시적 지시가 있을 때만.** 자동 커밋 금지.
- DB 스키마 변경은 항상 `sql/migrations/`에 번호 SQL로 남기고 커밋(재현성). Supabase SQL Editor에서 실행.

### 디자인 핸드오프 폴더 — 중복 방지 규칙 (2026-08-05 확립)
사용자가 `매치포스트 PC 디자인 핸드오프 (N)` 폴더를 레포 루트에 통째로 떨어뜨려 놓는 일이 반복됨(Claude Design 산출물, git에는 안 올라가는 임시 다운로드). 매번 아래 순서로 처리:
1. 폴더 안 하위폴더(`handoff_D5_delta` 등)의 파일들을 `docs/design/<현재 라운드>/`(예: `docs/design/d5/`)의 기존 파일과 대조 — 문장부호·줄바꿈 스타일 차이는 무시하고 **A/B/C 항목·결정·규칙 내용이 실제로 바뀌었는지만** 본다.
2. 내용이 같으면(재수출본): 새로 추가된 부분(보통 DECISIONS 파일 끝의 "구현 중 결정" 로그류)만 기존 파일에 병합하고, 다운로드 폴더는 그대로 삭제. 새로 구현할 것 없음.
3. 진짜 새 라운드(항목 자체가 바뀌었거나 라운드 번호가 다름)면 `docs/design/d<N+1>/`로 새로 만들고 이전 라운드 폴더는 그대로 둔다(아직 참고할 수 있어 archive 안 함).
4. `매치포스트 PC 디자인 핸드오프 (N)` 폴더 자체는 처리 끝나면 **항상 삭제** — 레포에 남기지 않는다.
5. 레포 루트에 `IMPLEMENT-*.md` 낱장이 떨어져 있으면(1~4차 시절 관행) `design/_archive/`로 옮긴다 — 1~4차분은 이미 옮겨둠.

이렇게 하면 "어느 문서가 최신인가"를 매번 판단할 필요 없이 `docs/design/d5/`(또는 최신 라운드 폴더) 하나만 보면 된다.

## 개요
- 광고주 ↔ 인플루언서 **달력 기반 매칭 + 딜시트(캠페인 프로젝트 관리)** 플랫폼
- Next.js 16 (App Router) + Supabase + Tailwind. GitHub: umph112/matchpost. 배포: Vercel.

## 기기 세팅 (노트북 등 새 환경)
```bash
cd ~ && git clone https://github.com/umph112/matchpost.git && cd matchpost   # 처음
# 이미 있으면: cd ~/matchpost && git pull
npm install
# .env.local 생성 — 아래 5개 키 필요 (값은 git에 없음, 데스크탑 .env.local에서 가져오기)
#   NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY
#   NAVER_API_CLIENT_ID / NAVER_API_CLIENT_SECRET  (네이버 지역검색 — 장소 자동입력용)
npm run dev   # http://localhost:3000
```
- Node 20+ 권장. Supabase는 클라우드 공용이라 DB·마이그레이션은 이미 적용됨(새 환경에서 따로 안 함).

## 핵심 구조
```
src/app/(dashboard)/advertiser/
  dashboard/page.tsx        마이페이지(캠페인 캘린더 + 내 캠페인 진행중/종료 탭 → 딜시트 진입)
  campaigns/new/page.tsx    캠페인 등록 폼(대부분의 최근 작업이 여기)
  campaigns/[id]/page.tsx   캠페인 상세 = 딜시트 진입점(현재 참여자 목록+메시지, 딜시트로 확장 예정)
  messages/…                대시(1:1 메시지)
src/app/(dashboard)/influencer/…   인플루언서측(대시보드/검색/제안/프로필 등)
src/components/
  DealConfirmBar.tsx        협업 확정 바 + 확정 시 연락처 공개 카드
  MyCampaignsList.tsx       내 캠페인 진행중/종료 탭
  TimeSelect.tsx            24시간 시/분 드롭다운
src/app/api/
  deal/confirm, deal/contact   협업 확정 / 확정 시 상대 연락처 반환(당사자+상호확정 이중검증)
  search-place                 네이버 지역검색 프록시(장소 자동입력)
sql/migrations/              스키마 변경 이력(0001~). README 참고
```

## 지금까지 완료
- **연락처 공개**: 양쪽 협업확정 시에만 상대 연락처(전화 tel/문자 sms/메일) 공개. 철회 시 자동 재비공개.
- **캠페인 등록 폼 대개편**(campaigns/new), 순서: 채널(복수: 블로그/유튜브/인스타/틱톡) → 구분(제품/지역/기자단) → 추가옵션(구매평·네이버클립, 비용 직접입력) → 카테고리(공용 INFLUENCER_CATEGORIES) → 제목 → 참여 인플루언서 모집일정(신청기간·발표·콘텐츠등록기간·모집인원) → 캠페인 진행일정(지역만: 하루/기간 최대30일, 평일시간+주말/휴일시간) → 장소(지역만: 네이버검색 자동입력) → 예산(만원, 세금포함) → 콘텐츠 수량(채널별 1~99) → 결제(예정일/규칙+방식 세금계산서·3.3% 복수) → 필수키워드(#, 최대20) → 상세 → 공개.
- **마이페이지 딜시트 진입**: 내 캠페인 진행중/종료 탭 → 클릭 시 캠페인 상세.

## 설계 원칙 (딜시트 — 아직 상세 구현 전, 방향 확정)
- 딜시트 = **광고주 프로젝트 관리 콘솔** + **인플루언서 참여 캠페인 숙지 뷰**(같은 campaigns 데이터 양면).
- 프로젝트 = 캠페인. 인플루언서는 **매칭/대시(proposal) 거친 인원만** 참여.
- 모집~확정 루틴: (A) 인플루언서 신청(pull) + (B) 광고주 초대(push: 검색/친구등록DB/과거대시) → 대시 협의 → 확정.
- **확정 규칙**: 대시를 먼저 보낸 개시자는 자동 확정 → 상대만 확정하면 완료. 개시자는 다시 눌러 철회(토글). `proposals.initiated_by`(신규) + `deal/confirm`을 토글로 변경 필요.
- 세무자료: 세금계산서(발행주체+상대 사업자등록증) / 3.3%(신분증X, 전화번호·국세청ID) → 대시서 교환 → 딜시트 체크. 플랫폼 밖 교환 대비 갭체크+양방향 알림+셀프입력.
- **결제 실행은 하지 않음**(기록·추적만). 향후 캠페인별 수수료 도입 시 budget_total 포함+딜시트 표기(코드 TODO(수수료)).

## 구현 현황 (2026-08-03 업데이트)

### 완료된 마이그레이션 (0001~0033 모두 Supabase 실행 완료)
- 0012: 딜시트 스키마 (proposals stage/upload_url/inspection 등, campaigns 일정)
- 0023: deal_checkpoints (가이드/업로드/검사/정산 체크포인트 + 기한)
- 0025: paid_confirmed_at, paid_disputed_at (수금 확인), settlement_attempts
- 0026: reports (신고, 8종 type)
- 0027: sanctions (제재 0~5단계, user_sanction_level 뷰)
- 0028: cancellations (협의 취소)
- 0029: proposals.start_at + duration_min
- 0030: connections (상호 등록, active_connections 뷰)
- 0031: messages.checkpoint_kind
- 0032: profiles/campaigns manager_phone + company_phone
- 0033: blog_score_history (score_version, crawled_on, unique 인덱스)

### IMPLEMENT-3 완료 (커밋 ab2b0af, 5f748a6, 0343332)
- ✅ Item 1: DealSheet 진행바 + DeadlineChip (D-N/D+N, 지연 날짜→날짜 표시)
- ✅ Item 2: SettleConfirmModal (광고주 정산 기록, 3.3% 원천징수 토글)
- ✅ Item 3: PaidConfirmModal (인플루언서 수금 확인) + earnings 페이지 amber 배너
- ✅ Item 4: DealSheet 재정산 루프 — "재정산 필요" 뱃지 + "재정산 완료로 기록" 버튼
- ✅ Item 5: ReviewModal width 460, 태그 개편, 1000C 보상 문구
- ✅ Item 6: blue→amber 전면 정리 (오픈 일정/HomeCalendar 파란색 유지)
- ✅ Item 7: initial() 유틸, 채팅 scrollTop 수정, 메시지→대화, 수입→매출

### IMPLEMENT-4 완료 (커밋 9496587, dc3912d)
- ✅ SQL 마이그레이션 0026~0033 생성 + Supabase 실행 완료

### 미완료
- Item 8 (IMPLEMENT-3): `scripts/blog_analyzer.py` 블로그 평가 스크립트 개편

### 디자인 구현 (2026-08-01 기준)
- ✅ **① 로고 교체** — mark.svg + Archivo 워드마크 (커밋 cb3966b)
- ✅ **② Screen 4** — 캠페인 등록 폼 `grid-cols-[1fr_320px]` + sticky 사이드바
- ✅ **③ Screen 2** — 캠페인 목록 7열 PC 표 + 필터 탭
- ✅ **④ Screen 5** — 인플루언서 찾기 284px 필터 사이드바
- ✅ **⑤ Screen 3** — 딜시트: 8단계 진행바, 채널 그룹 표, 하단 정산 바

### 주의: 푸시 전 빌드 체크 필수
```bash
npx tsc --noEmit   # 에러 0건 확인 후 git push
```
(2026-08-03 earnings/page.tsx 타입 에러로 Vercel 배포 실패 사례 있었음)

## 디자인 시스템 (새 페이지 작성 시 반드시 준수)

### 색상 토큰
```
배경(페이지)  #F6F6F7
배경(카드)    #FFFFFF
테두리        #EAEAEE   (기본) / #F1F1F4 (연한)
텍스트(본문)  #17171B   (근흑)
텍스트(보조)  #9A9AA5   (11px 레이블) / #7C7C88 (단위·서브)
텍스트(3차)   #5C5C68
브랜드 앰버   #F59E0B   (버튼·포인트·크레딧)
위험           #EF4444
성공           #10B981
```

### 채널 배지 색상 (CH_GROUP)
```
블로그      bg #DCFCE7  text #15803D
유튜브      bg #FEE2E2  text #DC2626
인스타그램  bg #FCE7F3  text #BE185D
틱톡        bg #E8E8EC  text #17171B
```

### 레이아웃 패턴
- **PC 셸 (광고주)**: `AdvertiserShell` 사용 — 236px 사이드바 + `main.adv-pc` 래퍼
  - PC 전용: `hidden [.adv-pc_&]:block` / 모바일 전용: `block [.adv-pc_&]:hidden`
  - PC 조건부 스타일: `[.adv-pc_&]:grid-cols-[284px_minmax(0,1fr)]` 등
- **관리자/공개 좁은 페이지**: `max-w-4xl mx-auto px-4 py-8` (또는 `max-w-5xl`)
- **PC 필터 사이드바**: `284px` sticky `top-[84px]`

### 컴포넌트 패턴

#### 카드
```tsx
<div className="bg-white rounded-2xl p-5 shadow-sm">
```

#### 입력 폼
```tsx
// 인풋
<input className="w-full px-3 py-2 text-sm rounded-xl border border-[#EAEAEE] focus:outline-none focus:border-amber-400" />
// 레이블
<label className="text-xs font-semibold text-gray-500 mb-1 block">
```

#### 버튼
```tsx
// 주요 (앰버)
<button className="px-4 py-2 text-sm font-bold bg-amber-500 text-white rounded-xl hover:bg-amber-600 transition disabled:opacity-40">
// 보조 (흰 테두리)
<button className="px-4 py-2 text-sm font-medium border border-[#EAEAEE] text-[#17171B] rounded-xl hover:bg-[#F6F6F7] transition">
// 관리자 파란 계열
<button className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition">
```

#### 배지/태그
```tsx
<span className="text-xs px-2 py-1 rounded-full font-medium bg-emerald-100 text-emerald-600">
```

#### PC 헤더 (AdvertiserShell 내 top bar)
- 높이: `h-16` / 배경: `bg-white/[.88] backdrop-blur-[10px]` / sticky + z-30

#### 글꼴
- 본문: Pretendard (자동 적용)
- 로고 워드마크: Archivo
- 강조 수치: `font-extrabold tracking-[-0.02em]`
- 보조 레이블: `text-[11px] text-[#9A9AA5]`

### 크레딧 표시 규칙
- 잔액: `{n.toLocaleString()} C` — C는 `text-[#F59E0B]` (앰버)
- 지급(양수): `text-emerald-600` / 차감(음수): `text-red-500`
- 금액 prefix: `+12,000 C` / `-5,000 C`

### 딜시트 단계 (8 stages)
신청 → 확정 → 가이드 → 방문 → 업로드 → 수정·컴프 → 검사 → 정산
- 제품/기자단: 방문 단계 없음 (7 stages)

### 매치 스코어 (`src/components/MatchScore.tsx`)
- 0~100점 배지. `score: number | null` (null = 신규, 리뷰 없음)
- 4단계 색상:
  - 신규(null): 흰 배경 + `#9A9AA5` 테두리, "신규" 텍스트
  - 0~59: `bg #F1F1F4` / `text #7C7C88` / bar `#C4C4CE`
  - 60~79: `bg #DBEAFE` / `text #1D4ED8` / bar `#3B82F6`
  - 80~89: `bg #FEF3C7` / `text #D97706` / bar `#F59E0B`
  - 90~100: `bg #FEF3C7` / `text #B45309` / bar `#F59E0B` (골드)
- size prop: `sm`(인라인 배지, 기본) / `lg`(프로필 상단 크게)
- **⚠️ 디자인 개선 필요**: 현재 sm 배지가 단순 숫자+"M" 표기 — 추후 아이콘·그래픽 강화 검토
- 노출 위치: 인플루언서 찾기 카드 / 딜시트 인플루언서 컬럼 / 메시지 목록 / 채팅 헤더

### 리뷰 모달 (`src/components/ReviewModal.tsx`)
- 별점(1~5) + 태그 복수선택 + 한 줄 코멘트 (200자)
- 블라인드: 양쪽 제출 후 동시 공개 — 제출 전 "상대방도 평가해야 공개" 안내 문구 표시
- 광고주 태그: 콘텐츠 퀄리티 / 마감 준수 / 가이드 이행 / 소통 원활 / 또 함께하고 싶어요
- 인플루언서 태그: 가이드 명확 / 결제 약속 이행 / 소통 원활 / 전문적인 파트너 / 재계약 의향
- 활성 태그: `bg-amber-500 text-white` / 비활성: `border-[#EAEAEE] text-[#5C5C68]`
- **⚠️ 디자인 개선 필요**: 별점 UI가 텍스트 ★ — 추후 SVG 별 아이콘으로 교체 검토
- **⚠️ 미구현**: 인플루언서 → 광고주 리뷰 진입점 (현재 광고주 측 딜시트에서만 평가 가능)

## 이전 후보 (아직 유효)
- proposals에 initiated_by 추가 + confirm 토글화(개시자 자동확정/철회)
- 캘린더 월 이동(‹›) — `?ym=YYYY-MM` 서버 재조회
- 장소 **지도 시각화**(NCP Maps 키 필요, 현재 주소 자동입력만)
- 캠페인 진행일정 **공휴일 자동감지**(data.go.kr 특일정보, 현재 주말만)
- 친구등록 인플루언서 favorites 테이블 구현(현재 예시 데이터)

## 인플루언서 마이페이지 디자인 스펙

> **플랫폼 방향**
> - 관리자(admin) = PC 우선
> - 광고주(advertiser) = PC 우선 (현재 AdvertiserShell 기반으로 구현됨)
> - 인플루언서(influencer) = 모바일 우선 → PC는 추후
> 비주얼 스펙 파일: `design/influencer-mypage-spec.html` (브라우저로 열기)

### 전체 페이지 구조 (`/influencer/*`)

**대시보드** (`/influencer/dashboard`) — 홈, 아래 섹션을 순서대로 포함:
1. 🔔 액션 배너 — 새 알림·당일 정산 알림 (조건부)
2. 📅 내 캘린더 — 이달 오픈·매칭 캠페인 날짜
3. ⚡ 빠른 액션 — 오픈 등록 / 캠페인 검색 2버튼
4. 💬 대시·메시지 — 최근 대화 3개 미리보기 → `/messages`
5. 🔔 알림함 — 최근 알림 3개 + 미읽음 수 → `/notifications`
6. 📋 내 오픈 목록 — 진행중·메이드·마감·캔슬 → `/schedule/list`
7. 📊 **내 채널 분석** (신규) — 블로그 등급·노출 요약 카드 → `/channel-analytics`
8. 💰 이번 달 매출 — 월간 매출 + 정산 예정 → `/earnings`

**하위 독립 페이지:**
| 페이지 | 경로 | 설명 |
|---|---|---|
| 채널 분석 상세 ★NEW | `/influencer/channel-analytics` | BlogAnalyticsFull — 포스팅별 키워드 노출 |
| 오픈 등록 | `/influencer/schedule` | 광고 협업 오픈 등록 폼 |
| 오픈 목록 | `/influencer/schedule/list` | 내 오픈 전체 + 상태 관리 |
| 캠페인 검색 | `/influencer/search` | 광고주 캠페인 탐색·신청 |
| 제안 | `/influencer/proposals` | 받은 제안 목록·수락·거절 |
| 메시지 | `/influencer/messages` | 광고주와 1:1 채팅 |
| 알림 | `/influencer/notifications` | 시스템 알림 전체 목록 |
| 매출 | `/influencer/earnings` | 정산 내역·월별 매출 통계 |
| 프로필 편집 | `/influencer/profile` | 기본정보·플랫폼·카테고리·블로그 URL |

### 채널 분석 기능 (`BlogAnalyticsCard.tsx`)

블로그 평가 데이터를 인플루언서 마이페이지에 노출하는 기능.
수집 스크립트: `scripts/blog_analyzer.py` (네이버 API + 키워드 노출 체크 → Supabase upsert)

**컴포넌트:**
- `BlogAnalyticsSummaryCard` — 대시보드 요약 카드 (등급 뱃지 + 지표 칩 + 노출 프로그레스바)
- `BlogAnalyticsFull` — 상세 페이지용 (포스팅별 키워드 노출, 접었다 펴기)
- `BlogAnalyticsCompact` — 광고주 검색 결과 카드 한 줄 요약

**등급 시스템 (100점 만점):**
- 방문자 40점 / 검색 노출 35점 / 포스팅 빈도 15점 / 이웃 수 10점
- S ≥75 / A ≥55 / B ≥35 / C ≥15 / D
- 세분: X-1 / X-2 / X-3 (각 구간 3등분)

**채널 분석 컬러 (광고주 디자인 시스템과 별도):**
```
Grade B·노출  bg #DCFCE7 / text #15803D
Grade A       bg #DBEAFE / text #1D4ED8
Grade S       bg #FEF3C7 / text #B45309
미노출        bg #FEE2E2 / text #DC2626
노출 바       #22C55E
```

## 테스트 계정
- 인플루언서: umph112 / pun0406 / merry9849 (비번 동일)
- 광고주: advertiser@test.com
