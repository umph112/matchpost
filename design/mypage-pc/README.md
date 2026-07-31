# Handoff: 광고주 마이페이지 (PC 대시보드)

대상 레포: `umph112/matchpost` (Next.js 16 App Router + Tailwind + Supabase)
구현 경로: `src/app/(dashboard)/advertiser/dashboard/page.tsx` · `src/components/AdvertiserShell.tsx`
관련 브리프: `design/mypage-pc-handoff.md`, `design/advertiser-desktop.md`
디자인 레퍼런스: `advertiser-mypage-pc.dc.html` (브라우저로 열어 모양·인터랙션 확인용. 코드 복사 대상 아님)

> 참고: 이 README는 Claude Design 원본 핸드오프를 UTF-8 클린본으로 재작성한 것(수치·hex·토큰은 원본 그대로).

## Overview
광고주가 로그인 후 처음 보는 홈(마이페이지). 기존 모바일 폭(`max-w-lg`) 세로 스택을 **PC 파워 대시보드**로 재구성.
데이터·쿼리는 이미 `page.tsx`에 있고, 이 문서는 레이아웃·비주얼·상호작용만 정의. 구현은 기존 Next+Tailwind 패턴으로 새로 작성.

핵심 추가 기능: **캘린더 날짜 클릭 → 그 날 내 캠페인 + 공개 오픈 목록 → 항목 선택 시 상세 → 오픈 상세에서 "이 날짜로 대시 보내기"**.

## Fidelity
High-fidelity. 색·타이포·간격·상태 스타일이 타깃. 폰트는 Pretendard 권장(현재 Arial). 아이콘은 lucide-react 권장(현재 이모지).

---

## Screens / Views

### 1. 셸 (AdvertiserShell — PC 모드)
구조(사이드바 + 상단바 + main.adv-pc) 유지, 비주얼만 정리. **모바일 모드(adv-mobile)는 그대로.**

- 전체 컨테이너: `display:flex; min-height:100vh; min-width:1360px` — PC 전용이라 좁은 창이면 **가로 스크롤**(모바일 모드엔 미적용). 배경 `#F6F6F7`, 텍스트 `#1A1A1F`.
- 좌측 사이드바: `width:236px`, `background:#fff`, 우측 보더 `1px solid #EAEAEE`, `position:sticky; top:0; height:100vh`
  - 브랜드 영역: 높이 `64px`, 패딩 `0 20px`, 하단 보더 `1px solid #F1F1F4`. 로고 `22x22 radius:6px bg:#F59E0B` + 내부 흰 사각(`8x8 radius:2px`). "MATCHPOST" `15px/800/-0.02em/#17171B`
  - 섹션 라벨 "메뉴": `10px/700/#B0B0BB/letter-spacing:0.06em`, 패딩 `8px 10px 6px`
  - 메뉴 아이템: 패딩 `9px 10px`, `radius:8px`, `13.5px/600`, 아이콘 폭 `16px` opacity .75, gap 2px. 기본 `#5C5C68` / hover `#F6F6F7` / **활성** `bg:#FEF3C7; color:#B45309; font-weight:700`. 뱃지(우측): `10.5px/700`, `bg:#FEE2E2 color:#DC2626 radius:20px padding:1px 6px`
  - 메뉴: 대시보드 / 캠페인 / 인플루언서 / 메시지(2) / 알림(3) / 정산
  - 하단 고정(`margin-top:auto`), 상단 보더, 패딩 `14px 16px`: 라벨 "이번 달 집행 예정" `11px/#9A9AA5`, 금액 `16px/800/-0.02em`, "원" `12px/600/#7C7C88`
- 상단바: 높이 `64px`, `background:rgba(255,255,255,.88)+backdrop-blur(10px)`, 하단 보더 `1px solid #EAEAEE`, 패딩 `0 28px`, sticky z-30
  - 회사명 `14px/700`, 보조 `11px/#9A9AA5` ("광고주 콘솔 · 2026년 7월")
  - 우측: PC/모바일 세그먼트 토글(컨테이너 `bg:#F1F1F4 radius:8px padding:3px`, 선택 `bg:#fff #17171B 700 shadow`, 비선택 `#8A8A96`, `11.5px padding:5px 11px radius:6px`) — 기존 `localStorage('advViewMode')` 연결 / 알림 버튼 `34x34 radius:8px border:#EAEAEE` + 카운트 뱃지(`#EF4444` 흰글자 `9.5px/700 border:2px solid #fff`) / 아바타 `34x34 원 bg:#FEF3C7 #B45309 13px/800`
- main.adv-pc: 패딩 `26px 28px 40px`, 세로 gap 20px, **`max-w-6xl mx-auto` 제거**(풀폭)

### 2. 본문
#### 2-1. 페이지 헤더
- 제목 "마이페이지" `23px/800/-0.03em`, 부제 `13px/#7C7C88` ("확정 대기 N건 · 오늘 마감 캠페인 N건이 있어요.")
- 우측 버튼 2개(높이 38, radius 9, 13px): 보조 "🔍 인플루언서 찾기"(흰 배경 border #E2E2E8 #3C3C46 600, hover #F6F6F7) → `/advertiser/search` / 주 "＋ 캠페인 등록"(bg #F59E0B 흰 700 shadow, hover #D97706) → `/advertiser/campaigns/new`

#### 2-2. KPI 행
`grid-cols-4 gap-14`. 카드: `bg #fff, border 1px #EAEAEE, radius 12, padding 16 18, gap 6`
- 라벨 행: `6x6 점(radius 2)` + `12px/600/#7C7C88`. 값 `26px/800/-0.035em/line-height:1`, 단위 `12px/600/#9A9AA5`. 보조 `11.5px/#9A9AA5`

| 카드 | 값 출처 | 점 |
|---|---|---|
| 진행중 캠페인 | `derivedStatus==='진행중'` 개수 / 보조: 이번 달 등록 수 | `#F59E0B` |
| 확정 인플루언서 | proposals 양쪽 확정 합계 / 보조: 협의중 수 | `#22C55E` |
| 확정 집행 예정 | `spendConfirmed` / 보조: "양쪽 확정 기준" | `#3B82F6` |
| 응답 대기 | 내가 받은 미응답 대화 수 / 보조: 평균 응답 시간 | `#EF4444` |

#### 2-3. 2단 그리드
`grid-template-columns: minmax(0,1.55fr) minmax(0,1fr); gap:20px; align-items:stretch`. 각 컬럼 `flex-col gap-20`, 각 컬럼 마지막 카드 `flex:1`(바닥 정렬).
- 공통 카드: `bg #fff, border 1px #EAEAEE, radius 14, overflow hidden`
- 공통 카드 헤더: 높이 `52`(고정), 패딩 `0 20`(좌)/`0 18`(우), 하단 보더 `1px #F1F1F4`, 제목 nowrap. 좌 제목 `14.5px/700/-0.01em`, 우 제목 `13.5px/700`. "전체보기 →" `12px/600/#B45309`(좌) `11.5px`(우)

**좌측 컬럼**
- **캠페인 캘린더**: 헤더에 제목 + 범례 2개(`11.5px/#7C7C88`, `7x7` 점) — 🟠 내 캠페인 N (내가 등록: advertiser_id=user.id), 🔵 공개 오픈 N (전체: is_public+open). 우측 월 네비 `‹ 2026. 7 ›`(26x26 radius6, hover #F6F6F7 / **월 이동은 미구현→`?ym=YYYY-MM` 서버 재조회 권장**). 본문 패딩 `14 20 18`. 요일행 `grid-cols-7 gap-6`(`11px/700`, 일 #EF4444 토 #3B82F6 나머지 #9A9AA5). 날짜 셀 `min-height:74`, `flex-col padding:6 radius:8 border:1px #F1F1F4 bg:#fff`. 숫자 `11.5px/500`(요일색). 오늘: border #FCD34D bg #FFFBEB 숫자 800/#B45309. 선택됨: border #F59E0B bg #FFFBEB `shadow 0 0 0 2px rgba(245,158,11,.25)`. 이벤트 칩(하단, gap2, `9.5px/600 radius3 padding:0 4` 말줄임): 캠페인 `bg #FEF3C7 #B45309 "캠페인 {n}"`, 오픈 `bg #DBEAFE #1D4ED8 "오픈 {n}"`. 일정 있는 날만 `cursor:pointer`+클릭, 없는 날 `cursor:default`
- **최근 캠페인**: 헤더 제목 + "총 N건" + 전체보기→`/advertiser/campaigns`. **표** `grid-cols: minmax(0,1fr) 96px 108px 120px 92px`. 헤더행 패딩 `9 20` bg #FAFAFB, 라벨 `11px/700/#9A9AA5`(3~5열 우정렬): 캠페인/상태/모집/확정 예산/딜시트. 데이터행 패딩 `13 20` 하단보더 #F5F5F7 hover #FAFAFB → `/advertiser/campaigns/{id}`. 1열 제목 `13.5px/600` 말줄임 + 메타 `11.5px/#9A9AA5`(구분·채널·지역·날짜). 2열 상태배지. 3열 `확정 {c}/{target}` + 진행바(`w:78 h:4 radius:2 bg:#F1F1F4`, 채움 상태색). 4열 예산 `12.5px/600 tabular-nums`(없으면 —). 5열 "열기 →" `12px/600/#B45309`

**우측 컬럼**
- **대시·메시지**: 제목+미응답 카운트 뱃지+전체보기. 행 패딩 `12 18` 하단보더 #F5F5F7 hover #FAFAFB gap11. 아바타 `34x34 원 #FEF3C7/#B45309 13/800`, 이름 `13/600`, 마지막 메시지 `11.5/#9A9AA5` 말줄임. 태그: 미응답 `#FEE2E2/#DC2626`, 상대 미확인 `#F1F1F4/#9A9AA5`(`10.5px radius20 padding:2 7`)
- **알림함**: 제목+카운트+전체보기. 행 패딩 `12 18` gap11. 미읽음 bg #FFFBEB 제목 700 / 읽음 bg #fff 제목 500. 아이콘 `14px`(기존 NOTIF_ICON 맵), 제목 `12.5px/-0.01em`, 본문 `11.5/#9A9AA5` 말줄임, 시간 `10.5/#B0B0BB`
- **친구등록 인플루언서**: 제목 옆 "예시" 뱃지(favorites 기능 전까지, 구현 후 제거). 행 패딩 `11 18` 아바타 `32x32 원 #F1F1F4/#5C5C68 12.5/700`, 이름 `12.5/600`, 메타 `11/#9A9AA5`(분야·팔로워). 우측 "초대" 버튼 `11/600/#7C7C88 border:1px #E2E2E8 radius6 padding:4 9` hover(bg #FEF3C7 #B45309 border #FDE68A)
- **양식함**(`flex:1`): 본문 패딩 `8 10 10`, 항목 패딩 `9 10 radius8` hover #FAFAFB. 📄 + 이름 `12.5/500` 말줄임 + (더미면)"예시" 뱃지. 데이터는 기존 page.tsx(campaign_detail_templates, 없으면 예시)

### 3. 날짜 상세 팝업 ⭐ (신규)
트리거: 캘린더에서 일정 있는 날짜 클릭. 오버레이 `fixed inset-0 z-60 bg:rgba(18,18,24,.44)` flex center 패딩48, 클릭 시 닫힘. 패널 `width:720 max-w:100% max-h:80vh bg:#fff radius16 overflow-hidden shadow(0 24px 64px rgba(0,0,0,.28))`, 내부 클릭 stopPropagation. `flex-col`(헤더/푸터 flex-shrink:0, 본문 overflow-y auto).

- **목록 뷰(기본)**: 헤더 제목 `2026년 7월 {d}일 ({요일})` `16/800`, 부제 `내 캠페인 N건 · 공개 오픈 N건` `12/#8A8A96`, 닫기 ✕. 항목(패딩12 radius10 gap12 hover #FAFAFB): 내 캠페인(아바타 `36x36 radius9 #FEF3C7/#B45309` "캠", 칩 "내 캠페인" #FEF3C7/#B45309, 제목 `13.5/700`, 메타 구분·채널·지역·날짜, 우측 `확정 N/M`) / 공개 오픈(아바타 `36x36 원 #DBEAFE/#1D4ED8` 이름첫글자, 칩 "공개 오픈" #DBEAFE/#1D4ED8, 제목 이름, 메타 분야·팔로워·채널·시간, 우측 희망페이). 정렬: 내 캠페인 먼저→공개 오픈. 우끝 `›`
- **상세 뷰(항목 클릭)**: 헤더 ‹ 뒤로 + 제목 `16/800` + 상태/종류 칩 + 부제 + ✕. 본문 정의목록 `grid-cols: 104px minmax(0,1fr) gap14`, 행 패딩 `11 0` 하단보더 #F5F5F7, 라벨 `12.5/600/#9A9AA5` 값 `13/500/#2A2A33`
  - 캠페인 상세 필드: 유형/채널/모집 일정/진행 일정/장소/예산/미션/결제(있는 것만). 부제 `7월 D일 (요일) · 확정 N/M명`, 칩=상태배지
  - 오픈 상세 필드: 오픈 날짜/가능 시간/채널/희망 지역/희망 페이. 부제 `분야 · 팔로워 N`, 칩 "공개 오픈". 하단 인플루언서 메모 블록(`bg #F6F6F7 radius10 padding:13 15 margin-top:14`, 라벨 `11/700/#9A9AA5`, 본문 `13/line-height:1.6/#3C3C46`)
  - 푸터 패딩 `14 22` 상단보더 bg #FAFAFB. 좌 보조 버튼(캠페인="캠페인 수정" / 오픈="프로필 보기", 흰 border #E2E2E8 `13/600`), 우 주 버튼(`margin-left:auto`, 캠페인="딜시트 열기 →" / 오픈=**"이 날짜로 대시 보내기 →"**, bg #F59E0B 흰 700 shadow)

---

## Interactions
| 트리거 | 동작 |
|---|---|
| 캘린더 날짜 클릭(일정 있음) | 팝업 열림 + 해당 셀 하이라이트 |
| 날짜 클릭(일정 없음) | 무반응(cursor:default) |
| 오버레이/✕ | 팝업 닫힘 + 선택 초기화 |
| 목록 항목 클릭 | 같은 패널 내 상세 뷰로 전환 |
| 상세 ‹ | 목록 뷰 복귀(날짜 유지) |
| 딜시트 열기 | `/advertiser/campaigns/{id}` |
| 캠페인 수정 | `/advertiser/campaigns/{id}/edit`(없으면 상세로) |
| 이 날짜로 대시 보내기 | 대시 생성 프리필. `/advertiser/messages?to={influencerId}&date={YYYY-MM-DD}` 권장 |
| 프로필 보기 | 인플루언서 프로필 |
| 표 행/KPI/사이드바 | 각 링크 이동 |

미구현/후속: 월 이동(‹›)=서버 쿼리 파라미터, 초대·친구등록=favorites 테이블, 팝업 내 오픈 목록 필터=2차.
접근성: 팝업 `role="dialog" aria-modal="true"`, ESC 닫기, 포커스 트랩, 날짜 셀 `<button>`.
반응형: PC 모드 `min-width:1360` 고정+가로 스크롤. 모바일 모드 기존 유지. PC 전용은 `[.adv-pc_&]:` 패턴.

## State (클라이언트)
캘린더를 감싸는 클라이언트 컴포넌트에서 관리:
```
selectedDay: number | null
selectedItem: { type:'campaign'|'open', data } | null   // null이면 목록 뷰
```
데이터 요구: 기존 page.tsx는 캘린더용 카운트(countsByDate)만 내려줌. 팝업 목록/상세가 필요하므로 이번 달 `campaigns`(내 것)와 `schedules`(공개 오픈)를 **날짜 단위 목록**으로 내려야 함. 오픈은 `profiles`/`influencer_profiles` 조인(이름·분야·팔로워·채널·지역·시간·메모).
⚠️ `schedules`에 **채널·희망페이·메모 컬럼 없음** → `sql/migrations/`에 추가 마이그레이션 필요(4단계).

## Design Tokens
색:
| 용도 | 값 |
|---|---|
| 페이지 배경 | `#F6F6F7` |
| 카드/서피스 | `#FFFFFF` |
| 미묘한 서피스(표 헤더·푸터) | `#FAFAFB` |
| 보더(카드) | `#EAEAEE` / 구분선 `#F1F1F4` / 행구분 `#F5F5F7` |
| 텍스트 1차 | `#1A1A1F` / 강조 제목 `#17171B` |
| 텍스트 2차 | `#5C5C68` · `#7C7C88` |
| 텍스트 3차 | `#9A9AA5` · `#B0B0BB` · `#C4C4CE` |
| 액센트(브랜드) | `#F59E0B` / hover `#D97706` / 텍스트 `#B45309` / 연배경 `#FEF3C7`·`#FFFBEB` / 보더 `#FCD34D`·`#FDE68A` |
| 오픈(인플루언서) | `#3B82F6` / 텍스트 `#1D4ED8` / 배경 `#DBEAFE` |
| 성공(확정) | `#22C55E` / 텍스트 `#15803D` / 배경 `#DCFCE7` |
| 경고(미응답·캔슬) | `#EF4444` / 텍스트 `#DC2626` / 배경 `#FEE2E2` / 바 `#F87171` |
| 중립(마감) | 배경 `#F1F1F4` / 텍스트 `#7C7C88` / 바 `#C4C4CE` |

타이포: Pretendard Variable (fallback -apple-system, "Apple SD Gothic Neo").
페이지제목 23/800, KPI값 26/800, 팝업제목 16/800, 브랜드 15~16/800, 카드제목(좌) 14.5/700 (우) 13.5/700, 본문강조 13.5/600, 본문 13/500~600, 보조 12~12.5, 캡션 11~11.5, 마이크로 9.5~10.5/700.
간격: 2·4·6·8·10·12·14·18·20·26·28. 라운드: 2(점)·4·5(칩)·6·8·9(버튼)·10·12(KPI)·14(카드)·16(팝업)·20(pill)·50%.
그림자: 주버튼 `0 1px 2px rgba(245,158,11,.35)` / 세그먼트 `0 1px 2px rgba(0,0,0,.06)` / 팝업 `0 24px 64px rgba(0,0,0,.28)` / 선택셀 `0 0 0 2px rgba(245,158,11,.25)`.
고정 치수: 사이드바 236 · 카드헤더 52 · 상단바 64 · 버튼 38 · 날짜셀 min 74 · 팝업 720 · 셸 min-width 1360.

## Tailwind 매핑
amber(#F59E0B/#D97706/#B45309/#FEF3C7/#FFFBEB/#FCD34D/#FDE68A)=`amber-500/600/700/100/50/300/200`, blue=`blue-500/700/100`, green=`green-500/700/100`, red=`red-500/600/100`. 회색계(#F6F6F7 #F1F1F4 #EAEAEE #9A9AA5 #5C5C68 #1A1A1F)는 기본 gray와 다른 뉴트럴 → 임의값 또는 theme 확장. 소수 px(13.5 등)은 `text-[13.5px]` 임의값 사용.

## Assets
외부 이미지 없음. 사이드바 아이콘 lucide-react 권장, 알림 이모지는 기존 NOTIF_ICON 유지. 폰트 Pretendard CDN 또는 next/font.

## 구현 순서 제안
1. AdvertiserShell PC 모드 비주얼 정리 (사이드바·상단바·min-width·max-w-6xl 제거)
2. 대시보드 page.tsx PC 레이아웃: KPI 행 + 2단 그리드 (`[.adv-pc_&]:` 패턴)
3. 최근 캠페인 카드 → 표 컴포넌트 (진행바·확정 예산 열 추가)
4. 캘린더 데이터 확장(카운트→목록) + `schedules` 필드 마이그레이션 검토
5. 날짜 팝업(목록→상세) 구현
6. "이 날짜로 대시 보내기" → 대시 생성 프리필 연결

---

## Screen 2 — 캠페인 목록 (`/advertiser/campaigns`)

### 구조
PC 모드: 상단 필터 바 + 7열 표. 모바일 모드: 기존 카드 목록 유지.

### 상단 영역
- 페이지 헤더: 제목 "캠페인 목록" + 우측 "+ 캠페인 등록" 버튼(amber)
- 필터 탭: 전체 / 진행중 / 마감 / 완료 / 취소 (활성탭 amber 600 border-bottom 2px)
- 검색 인풋 + 정렬 드롭다운 (날짜순 / 예산순)

### 표 (PC only)
`grid-template-columns: minmax(0,1fr) 92px 150px 122px 158px 128px 108px`

| 열 | 내용 |
|---|---|
| 캠페인 | 제목 + 메타(유형·채널·지역) |
| 상태 | 상태 배지 |
| 유형·채널 | 구분 칩 + 채널 아이콘 |
| 진행일 | 시작일~종료일 |
| 모집현황 | 확정/목표 + 진행바 |
| 확정예산 | 원 단위 (오른쪽 정렬) |
| 액션 | 딜시트 버튼(amber outline) · 복사 버튼(gray) |

- 헤더행: `bg:#FAFAFB` `11px/700/#9A9AA5`
- 데이터행: 패딩 `13 20` 하단보더 `#F5F5F7` hover `#FAFAFB` cursor pointer
- 페이지네이션: 하단 중앙, 이전/다음 + 페이지 번호

---

## Screen 3 — 딜시트 (`/advertiser/campaigns/[id]`)

### 구조
헤더 섹션 + 채널 그룹별 인플루언서 표 + 하단 정산 바.

### 인플루언서별 진행 단계 (8단계)
`신청 → 확정 → 가이드 → 방문 → 업로드 → 수정/컴프 → 검사 → 정산`
- 지역 캠페인: 8단계 전체
- 제품·기자단: 방문 제외 7단계 (방문 열 숨김)

### 채널 그룹 헤더
| 채널 | 텍스트 | 배경 |
|---|---|---|
| 블로그 | `#15803D` | `#DCFCE7` |
| 유튜브 | `#DC2626` | `#FEE2E2` |
| 인스타 | `#BE185D` | `#FCE7F3` |
| 틱톡 | `#17171B` | `#E8E8EC` |

### 표 열 구성
`grid-template-columns: 36px 224px 112px 218px minmax(0,1fr) 112px 116px 92px`
- 체크박스 / 인플루언서(아바타+이름+팔로워) / 채널 / 단계 진행바 / 업로드URL / 검사일 / 세무자료 / 정산상태

### 성과 팝업
- 트리거: 행 클릭 또는 "성과 보기" 버튼
- 패널: `width:640px` 오버레이 위, 채널별 지표(조회수·좋아요·댓글·저장) + 누적 합계

### 하단 정산 바
`background:#17171B` (다크), 고정 바텀. 선택된 인플루언서 수 + 합계 금액 + "정산 처리" 버튼

### 갭 경고 배너
세무자료 미수령 또는 업로드 마감 임박 시 상단 amber 배너 자동 표시.

### 필요 스키마 추가 (sql/migrations/0012~)
**`proposals` 컬럼 추가:**
- `stage` (text) — 현재 진행 단계
- `visit_at` (timestamptz) — 방문 일시 (지역 캠페인용)
- `visit_confirmed` (boolean)
- `upload_url` (text)
- `inspection_url` (text)
- `inspection_at` (date)
- `inspection_status` (text) — 통과/미통과/검토중
- `tax_doc_type` (text) — 세금계산서/3.3%
- `tax_doc_received` (boolean)
- `settlement_status` (text) — 미정산/정산중/완료
- `performance_metrics` (jsonb) — `{views, likes, comments, saves}`

**`campaigns` 컬럼 추가:**
- `upload_deadline` (date)
- `inspection_deadline` (date)
- `settlement_date` (date)

---

## Screen 4 — 캠페인 등록 폼 (`/advertiser/campaigns/new`)

### 레이아웃 변경 (PC 모드)
기존 `[.adv-pc_&]:columns-2` → 2열 사이드바 레이아웃으로 교체.

```
[.adv-pc_&]:grid
[.adv-pc_&]:grid-cols-[minmax(0,1fr)_320px]
[.adv-pc_&]:gap-5
[.adv-pc_&]:items-start
```

우측 사이드바: `position:sticky; top:84px` (상단바 64px + 20px 여유)
```
[.adv-pc_&]:sticky [.adv-pc_&]:top-[84px]
```

### 우측 사이드바 섹션 구성
1. **예산·결제 요약 카드** — 입력한 예산·결제 방식 실시간 미리보기 (`bg:#FAFAFB border:#EAEAEE radius:12`)
2. **추가옵션 요약** — 선택된 옵션 칩 목록
3. **등록 전 확인 체크리스트** — 필수 입력 항목 완료 여부 자동 체크 (`✓` 그린 / `○` 회색)
4. **캠페인 등록 버튼** — amber, `w-full h-12 radius:10 font-bold`

### 구현 방법
- 기존 `campaigns/new/page.tsx` 내 폼 `<form>` 래퍼에 PC 그리드 클래스 추가
- 우측 사이드바는 별도 `<div>` 블록 — 폼 state를 props로 받아 표시 (또는 form context)
- 모바일 모드는 기존 단일 컬럼 그대로

---

## Screen 5 — 인플루언서 찾기 (`/advertiser/search`)

### 레이아웃
```
[.adv-pc_&]:grid
[.adv-pc_&]:grid-cols-[284px_minmax(0,1fr)]
[.adv-pc_&]:gap-5
[.adv-pc_&]:items-start
```

### 좌측 필터 사이드바
`position:sticky; top:84px`
필터 그룹:
- **날짜** — datepicker (공개 오픈 날짜 기준)
- **지역** — 체크박스 멀티
- **채널** — 블로그/유튜브/인스타/틱톡 체크
- **분야** — 23개 카테고리 체크 (INFLUENCER_CATEGORIES 기준)
- **희망페이** — 범위 슬라이더 (0~100만)
- **키워드** — 텍스트 인풋
- **친구등록만** — ☆ 토글 (favorites 테이블 완성 후 활성화)

### 우측 결과 영역
상단: 그룹 방식 탭 (날짜별 / 인플루언서별) + 정렬 드롭다운 + 결과 수

**날짜별 그룹** (`#3B82F6` 도트)
- 날짜 헤더 → 그 날짜의 오픈 카드 2열 그리드 `repeat(2, minmax(0,1fr)) gap:11px`

**인플루언서별 그룹** (`#F59E0B` 도트)
- 인플루언서 이름 헤더 → 해당 인플루언서의 오픈 날짜 카드들

**오픈 카드 구성**
- 아바타 + 이름 + 팔로워 + 분야 칩
- 날짜 / 채널 / 지역 / 희망페이
- CTA: **"이 날짜로 대시 →"** (amber, `w-full`)
- hover: `bg:#FFFBEB border:#FDE68A`

**정렬 옵션**
날짜 빠른순 / 페이 낮은순 / 팔로워 많은순 / 응답률 높은순

---

## 로고 (Logo)

### 파일 위치
`public/logo/matchpost-mark.svg` — 마크만 (64×64)
`public/logo/matchpost-lockup.svg` — 마크 + 워드마크 (468×64)
`public/logo/matchpost-favicon.svg` — 파비콘용 (64×64, 선 두께 강조)

### 마크 구조 (matchpost-mark.svg)
```
64×64 viewBox, rx:16.6, fill:#17171B
수평선: y=37.1, h=1.9, #FFFFFF opacity:0.26
수직선: x=24.3, w=1.9, #FFFFFF opacity:0.26
앰버 원: cx=25.3 cy=38.1 r=8.3, fill:#F59E0B
```
원의 중심 = 두 선의 교차점 → "포스트(게시) 위치" 은유.

### 워드마크 (lockup)
`MATCH` (Archivo 900, letter-spacing 0.055em) + amber 원(r=6.5) + `POST`
배경 없음, 다크 텍스트 기준. 라이트 배경용.

### 사이드바 사용 (AdvertiserShell)
```
마크 크기: 24×24
워드마크: font-size 19px (= 24 × 0.79), font-family Archivo, font-weight 900, letter-spacing 0.055em
gap: 10px
```

### 기존 로고 교체 방법 (AdvertiserShell.tsx)
```tsx
// 기존 brand div 내 인라인 SVG → 교체
<Image src="/logo/matchpost-mark.svg" width={24} height={24} alt="MatchPost" />
<span style={{ fontFamily: 'Archivo, sans-serif', fontWeight: 900, fontSize: 19, letterSpacing: '0.055em' }}>
  MATCH<span style={{ color: '#F59E0B' }}>·</span>POST
</span>
```
또는 `<img>` 태그로 간단히. Archivo 폰트는 Google Fonts에서 import.

---

## 신규 구현 순서 제안 (Screen 2-5)

1. **로고 교체** (AdvertiserShell.tsx) — 인라인 SVG 제거, mark.svg + Archivo 워드마크
2. **Screen 4** (캠페인 등록 폼 레이아웃) — `columns-2` → `grid 1fr 320px`, 우측 사이드바 추가. 로직 변경 없음.
3. **Screen 2** (캠페인 목록) — 7열 PC 표 + 필터 탭. `campaigns/page.tsx` 신규 또는 개편.
4. **Screen 5** (인플루언서 찾기) — 284px 필터 사이드바 + 결과 카드. `search/page.tsx` 개편.
5. **Screen 3** (딜시트) — DB 마이그레이션 0012 이후 구현. 가장 공수 크고 스키마 의존.

