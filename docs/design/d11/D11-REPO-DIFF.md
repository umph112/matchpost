# D11 — 레포 반영 diff (7장)

> 원본 handoff_D11_diff 는 채팅에 붙여넣기로만 전달됨(디스크에 없었고 인코딩이 깨진 상태로 왔음).
> 이 파일은 그 스펙을 **깨끗한 한국어로 재작성한 실행본**이다. 값·색·px 는 원본과 동일.
> 기준 트리: D10 커밋 `0d92152`. 목적: PC 레이아웃 D9/D10 스펙을 레포에 반영.

작업 순서: **1장부터 순서대로.** 각 장 끝의 grep/verify 로 검증.

---

## §1. gap 14px 통일 — ✅ 완료(PROMPT-3 교정 반영)

PC 카드 스택 간격은 14px. **단 모바일은 원래값(20px=`gap-5`) 유지** → PC 카드 스택은 `gap-5 [.adv-pc_&]:gap-[14px]` 로 적는다(모바일 무변경 규칙). 예외는 모달 내부(ReviewModal 76 / SettleConfirmModal 110)와 `/credits` 본문(16px).

편집한 곳:
- `advertiser/dashboard/page.tsx`
  - 216(페이지 루트 세로 스택) `gap-5 [.adv-pc_&]:gap-[14px]`
  - 258(2단 그리드 좌측 컬럼 내부) `gap-5 [.adv-pc_&]:gap-[14px]`
  - 341(2단 그리드 우측 컬럼 내부) `gap-5 [.adv-pc_&]:gap-[14px]`
  - 256(컬럼 「사이」 grid gap)은 `gap-[14px]` 그대로 — 컬럼 바깥이라 손대지 않음
- `components/SettlementsView.tsx` — 143(좌측 컬럼 내부) `gap-5 [.adv-pc_&]:gap-[14px]`  ·  142(컬럼 사이)는 그대로
- `advertiser/campaigns/new/page.tsx` — 1303(PC sticky 우측 컬럼) `[.adv-pc_&]:gap-4` → `[.adv-pc_&]:gap-[14px]`
- `advertiser/search/page.tsx` — 476 컨테이너는 §3 재구성 때 `flex-col gap-[14px]` 로 교체됨(별도)

> ⚠️ 이전 판단 오류 교정: 처음엔 gap 12건을 「전부 카드 간격 아님, 손대지 말 것」으로 봤으나
> PROMPT-3 에서 위 5건(216·258·341·143·1303)이 **PC 카드 스택**임이 확인됨. §1 이 놓쳤던 부분.

남는 7건은 **손대지 않음**(카드 간격 아님):
`dashboard:220`(필터 행 가로) · `MyCampaignsList:85`(필터 행 가로) · `search:235`(모바일 base) ·
`earnings:276` · `HomeCalendar:107` · `schedule/list:46` · DealSheet 5건 · 모달 3건.

---

## §2. MyCampaignsList 7열 그리드 — ✅ 확인(수정 없음)

헤더(133)·행(160) 모두:
`grid-template-columns: minmax(0,1fr) 92px 128px 104px 152px 124px 126px`

검증: `grep -n gridTemplateColumns MyCampaignsList.tsx` 에 128px 104px 152px 124px 126px 노출

---

## §3. 검색 필터 사이드바 → 상단 카드 — ✅ 완료(1단계: 구조만, PROMPT-2)

PROMPT-2 지시대로 **1단계(구조 이동)만** 반영. 달력/친구등록 카드는 미구현 기능이라 이번 범위 제외(2·3단계).

`advertiser/search/page.tsx`:
- 좌측 284px `<aside>` 2단 그리드 제거 → `filterSidebar` 를 **상단 전체폭 카드**, `resultsPanel` 하단 전체폭(`flex-col gap-[14px]`).
- 필터 카드 PC: `[.adv-pc_&]:grid grid-cols-4 gap-x-5 gap-y-[17px] pt-4 pb-[18px]`(모바일 base `flex-col gap-4` 유지).
- 날짜 섹션(첫 행): `[.adv-pc_&]:col-span-full pb-4 border-b border-[#F1F1F4]`, **`<input type="date">` 그대로**(7열 달력 미도입).
- 헤더·분야·친구등록 토글·검색 버튼: `[.adv-pc_&]:col-span-full`.
- 결과 그룹 머리(날짜별·인플루언서별): 라벨 뒤 가로선 `<div className="flex-1 h-px bg-[#E4E4E8]" />` 추가. 본문은 기존 `[.adv-pc_&]:grid-cols-2 gap-[11px]` 유지.

검증: `grep -n 284px search/page.tsx` = 0 ✅ · `grep -n aside search/page.tsx` = 0 ✅ · `npx next build` exit 0 ✅

---

## §4. /credits 2단 재구성 — ✅ 완료(PROMPT-2 교정 반영)

> PROMPT-2 교정: 단가표는 **차감 3종만**(오픈 등록 1,000 / 캠페인 개설 5,000 / 대시 보내기 500 = open_schedule/create_campaign/send_proposal).
> 「프로필 열람」(unlock_profile)은 화면에서 제외(creditConfig.ts 정의 자체는 그대로 둠). `saved`(청구되지 않은 {saved}C) 계산은 원장 기반 유지.


`credits/page.tsx`. `/credits`는 (dashboard) 밖 독립 라우트 → PC 2단은 `lg:` 미디어쿼리로 적용(모바일 단일단 유지).

- 본문: `grid-template-columns:332px minmax(0,1fr); gap:16px; align-items:stretch`
- 헤더 p: "캠페인을 열고 대시를 보낼 때 쓰는 크레딧이에요. **1C = 1원**" (13px #7C7C88, "1C = 1원"만 700 #3C3C46)
- 좌 검은 카드 `#17171B radius16 padding22/24 flex-col`:
  - 라벨: 7px amber 점 + "보유 크레딧" 11.5px/700 rgba(255,255,255,0.62) tracking0.02em
  - 숫자: 40px/800 tracking-0.04em #fff leading1 tabular + C링크 SVG 30px
  - 원 환산: "{잔액}원 상당" 12px rgba(255,255,255,0.42) mt7
  - 구분선: height1 rgba(255,255,255,0.1) margin18/0/14
  - 이번 달: flex-col gap9, 각 줄 flex baseline / 라벨 11.5px rgba(.5) / 값 12.5px/700 #fff ml-auto tabular
    - "이번 달 적립" {monthIn} 적립 · "이번 달 사용" {monthOut} 사용 · "남은 크레딧" {balance} 남음
  - 베타 note: "베타 기간이라 {saved}C 가 청구되지 않았어요" 11px rgba(.42) mt (saved>0만)
- 우: 단가표 카드 + 이력(CreditsHistoryClient — 이미 맞음)
  - 단가표 카드 `#fff border #EAEAEE radius14`
  - 헤더 height52 padding0/20 border-bottom, h2 "무엇에 쓰이나요" 14.5px/700
  - 행 padding13/20 border-bottom #F5F5F7 / 좌 항목명 12.5px/600 #2A2A33 + 부제 11px #9A9AA5 / 우 값
  - 값(부호 없음): 차감(active) `N 사용` · 지급(active) `N 적립` · 차감(beta_free) `지금은 무료` + `원래 NC`(11px #B0B0BB)
  - 금액은 creditConfig 에서만 읽음(하드코딩 금지)

C링크 SVG:
```
<svg viewBox="0 0 24 24" width="30" height="30" fill="none" style="display:block;margin-left:5px;flex-shrink:0">
  <circle cx="12" cy="12" r="12" fill="#F59E0B"/>
  <path d="M16.1 7.9A5.7 5.7 0 1 0 16.1 16.1" stroke="#17171B" stroke-width="3.4" stroke-linecap="round"/>
</svg>
```
검증: `grep -n 332px credits/page.tsx` 존재 · `grep -n "1C = 1원"` 존재 · `grep -n "지금은 무료"` 존재

---

## §5. 모달 z-index / 오버레이 — ✅ 완료

| 파일 | 줄 | z | overlay |
|---|---|---|---|
| ConfirmDashModal.tsx | 99 | z-[200] | bg-[rgba(17,17,21,0.5)] |
| ReportModal.tsx | 50 | z-[60] | bg-[rgba(23,23,27,0.42)] |
| CancelRequestModal.tsx | 31 | z-[60] | bg-[rgba(23,23,27,0.45)] |
| ReviewModal.tsx | 66 | z-[80] | bg-[rgba(18,18,24,0.44)] |
| SettleConfirmModal.tsx | 87 | z-[60] | bg-[rgba(23,23,27,0.45)] |
| PaidConfirmModal.tsx | 76 | z-[60] | bg-[rgba(23,23,27,0.45)] |
| advertiser/messages/[id]/page.tsx | 379 | z-[60] | bg-[rgba(17,17,21,0.42)] |
| HomeCalendar.tsx | 119 | z-[60] | bg-[rgba(23,23,27,0.42)] |
| admin/credits/policy/page.tsx | 86 | z-[60] | bg-[rgba(23,23,27,0.45)] |

안 건드림(정상): DealSheet.tsx:920 (`fixed bottom-0 z-50`), NotificationsRealtime.tsx:37 (`fixed top-16 z-50`).
검증: `grep -rn z-50 src/components src/app | grep "fixed inset-0"` = 0

---

## §6. 고아 페이지 정리 — ✅ 완료

- `advertiser/proposals/page.tsx` — `git rm` 삭제(`/new` 는 유지)
- `influencer/[id]/page.tsx`, `day/[date]/page.tsx` — proposals/new Link → `DashSendButton` 로 교체

---

## §7. 검증 grep + build — ✅ 완료

```
grep -n 284px  search/page.tsx        # 0     ✅
grep -n aside  search/page.tsx        # 0     ✅ (낡은 주석까지 정리)
grep -n 332px  credits/page.tsx       # 2     ✅
grep -n "1C = 1원" credits/page.tsx   # 1     ✅
grep -n "지금은 무료" credits/page.tsx # 1     ✅
grep -n unlock_profile credits/page.tsx # 0   ✅ (단가표 3종)
grep -rn z-50 … | grep "fixed inset-0" # 0    ✅
npx next build                        # exit 0 ✅
```

### PROMPT-3 후속(2026-08-15) — ✅ 완료

- gap PC 카드 스택 5건 교정: 216·258·341·143 → `gap-5 [.adv-pc_&]:gap-[14px]` / 1303 → `[.adv-pc_&]:gap-[14px]` (모바일 무변경).
- 오버레이 표기 통일: `AdvertiserShell.tsx:143` `bg-black/30` → `bg-[rgba(0,0,0,0.3)]` (픽셀 동일, 모바일 무변경).

검증:
```
grep -rn "gap-5" src/app/(dashboard) src/components | grep -v "adv-pc\|inf-pc\|Modal"   # 0
grep -rn "bg-black/" src/app src/components                                            # 0
npx next build                                                                          # exit 0
```
커밋 메시지: `docs(d11): gap 14px PC 변형 5건 + 오버레이 표기 통일`
