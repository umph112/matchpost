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
- ⚠️ **DB**: 마이그레이션 0010(`schedules` 채널·희망페이·메모), 0011(`campaigns` image_urls·cover_image_url) 실행 필요. Storage `campaign-images` 버킷(Public) 생성 필요. ⚠️ Vercel env에 네이버 키(NAVER_API_CLIENT_ID/SECRET) 추가 필요(배포판 장소검색·오픈 조인).

## 🚨 최우선 원칙
- **MatchPost와 KPGTR(manian)은 완전히 별개의 앱/프로젝트다.** 코드·파일·DB를 섞지 않는다. 필요한 연동은 **API를 통한 느슨한 결합만** 허용(나중에 콘텐츠 등을 API로 주고받는 정도). 각자 독립 배포·운영.
- **수정 전 사전 보고 + 승인**: 어느 파일의 어느 부분을 어떻게 바꿀지 먼저 보고하고 승인 후 실행. 요청한 부분만, 최소 범위로.
- **커밋/푸시는 명시적 지시가 있을 때만.** 자동 커밋 금지.
- DB 스키마 변경은 항상 `sql/migrations/`에 번호 SQL로 남기고 커밋(재현성). Supabase SQL Editor에서 실행.

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

## 디자인 구현 현황 (2026-08-01 업데이트)
디자인 핸드오프 `design/mypage-pc/README.md` (Screen 2-5 + 로고 스펙)

- ✅ **① 로고 교체** — mark.svg + Archivo 워드마크 (커밋 cb3966b)
- ✅ **② Screen 4** — 캠페인 등록 폼 `grid-cols-[1fr_320px]` + sticky 사이드바 (커밋 cb3966b)
- ✅ **③ Screen 2** — 캠페인 목록 7열 PC 표 + 필터 탭 (커밋 cb3966b)
- ✅ **④ Screen 5** — 인플루언서 찾기 284px 필터 사이드바 + 날짜별/인플루언서별 그룹 결과 카드
- ✅ **⑤ Screen 3** — 딜시트 (`campaigns/[id]`): 8단계 진행바, 채널 그룹 표, 하단 정산 바
  - `sql/migrations/0012_dealsheet.sql` 작성 완료 → **Supabase SQL Editor에서 실행 필요**
  - `proposals`: stage/visit_at/upload_url/inspection_url/inspection_at/inspection_status/tax_doc_type/tax_doc_received/settlement_status/performance_metrics
  - `campaigns`: upload_deadline/inspection_deadline/settlement_date

⚠️ **DB 실행 미완료**: 0010 / 0011 / 0012 모두 Supabase SQL Editor에서 실행 필요

## 이전 후보 (아직 유효)
- proposals에 initiated_by 추가 + confirm 토글화(개시자 자동확정/철회)
- 캘린더 월 이동(‹›) — `?ym=YYYY-MM` 서버 재조회
- 장소 **지도 시각화**(NCP Maps 키 필요, 현재 주소 자동입력만)
- 캠페인 진행일정 **공휴일 자동감지**(data.go.kr 특일정보, 현재 주말만)
- 친구등록 인플루언서 favorites 테이블 구현(현재 예시 데이터)

## 테스트 계정
- 인플루언서: umph112 / 광고주: advertiser@test.com
