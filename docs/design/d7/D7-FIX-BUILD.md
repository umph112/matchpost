# D7 수정 지시서 — 빌드 결과 전수 대조

대상: `umph112/matchpost@main` (tree a3574655509a, 2026-08-10 확인)
읽은 범위: `src/app` 라우트 목록 전체 + 아래 파일 정독

```
layout.tsx · page.tsx · (auth)/{layout,login,signup,pending} · (dashboard)/layout
advertiser/{layout,messages,messages/[id],settlements} · influencer/{messages,messages/[id],earnings}
intro/page · components/{AdvertiserShell,InfluencerShell,TopBar,Footer,ConfirmDashModal,SettlementsView}
components/messages/{ConversationRow,MessageBubble}
lib/{date,initial,campaign-stages,permissions,creditConfig,storage} · lib/credits/ledger
```

**동봉 문서 2개 — 둘 다 넘기세요.**

| 파일 | 내용 |
| --- | --- |
| `D7-FIX-BUILD.md` (이 문서) | 남은 결함 전부 + 파일 경로 + 확인 체크리스트 |
| `D7-APPENDIX-LANDING-SIGNUP.md` | 랜딩 · 로그인 · 가입 화면 명세 (색 · 크기 · 문구 값) |

---

# 0. 먼저 — D6 는 대부분 제대로 들어갔습니다

전수 대조 결과, D6 지시서의 규칙은 **원본 단일화 · 계산 규칙 · 배지 · 문구까지 정확히** 구현돼 있습니다.
아래는 확인된 것이고, **손대지 마세요.**

| D6 항목 | 구현 위치 | 상태 |
| --- | --- | --- |
| A1 아바타 모양 구분 | `components/messages/ConversationRow.tsx` | 파란 사각 / 노란 원 정확 |
| A2 보낸 사람 이름 | `components/messages/MessageBubble.tsx` | `showSenderName` |
| A3 개별 발송 + 확인 팝업 + 배너 | `advertiser/messages/[id]/page.tsx` | 문구까지 일치 |
| A4 단체 발송 배지 | `MessageBubble.tsx` `groupSentBadge` | 색·문구 일치 |
| A5 담당자 권한 · 대리 발송 | `lib/permissions.ts` + 대화방 | 배선 완료 |
| A6 날짜 제안 (선택 · 비활성 · 카드) | `components/ConfirmDashModal.tsx` | 「날짜를 골라야 보낼 수 있어요」까지 일치 |
| A7 날짜 수락 | `lib/deals/time.ts` + `MessageBubble` | 상대 카드에만 수락 버튼 |
| A9 미수 문의 → 기존 대화 | `influencer/earnings/page.tsx` | 「대시에서 문의하기」 |
| B1 조립식 9단계 | `lib/campaign-stages.ts` | 안내문 4갈래 일치 |
| B3 단계 인덱스 | 같은 파일 `reindexStage` | **`slice(0, i)` 정확** |
| C1 미수 3탭 · KPI · 안내 | `components/SettlementsView.tsx` | 문구까지 일치 |
| C4 진행바 분모 | 같은 파일 `settleableTargets` | 보류자 제외 정확 |
| C7 세 콘솔 「오늘」 | `lib/date.ts` `kstDateString` | 단일 원본 |
| D1 크레딧 카탈로그 | `lib/creditConfig.ts` | 단일 원본 |
| D2/D3 원장 | `lib/credits/ledger.ts` | charge/grant/refund/penalty |
| F1 사업자 정보 푸터 | `components/Footer.tsx` | 9항목 + 면책 문구 + 확인 링크 |
| F3 첨부 7일 삭제 | `lib/storage.ts` + `api/cron/purge-attachments` | 만료일 표시까지 |
| 배치 작업 | `api/admin/batch/*` 11개 | 지연 알림 · 취소 자동확정 등 |

**이 문서는 그 위에 남은 것만 다룹니다.** 이전 D7 초안(부분 조사 기반)에서 「없다」고 적은 것 중
Footer · date.ts · initial.ts · campaign-stages · permissions · creditConfig · storage 는
**모두 이미 있습니다.** 그 초안은 버리고 이 문서를 쓰세요.

---

# 1. 치명 — 지금 당장

## 1-1. 광고주가 가입을 완주할 수 없다

```
src/app/(auth)/pending/pgae.tsx  →  src/app/(auth)/pending/page.tsx
```

**파일명 오타.** `page.tsx` 가 아니면 Next.js 는 라우트를 만들지 않고, **에러도 내지 않습니다.**
그래서 빌드가 통과했습니다.

영향:
- `signup/page.tsx` 는 광고주 가입 후 `router.push('/pending')`
- `login/page.tsx` 는 `status === 'pending'` 이면 `/pending`
- 두 경로 모두 **404**

파일명만 바꾸면 됩니다. 내용은 그대로 두세요.

## 1-2. 페이지 제목이 「Create Next App」

```
src/app/layout.tsx
```

```ts
export const metadata: Metadata = {
  title: { default: '매치포스트', template: '%s · 매치포스트' },
  description:
    '광고주와 인플루언서가 직접 만나는 협업 플랫폼. 날짜 · 지역 · 분야로 찾고, 대화 한 번으로 협업이 시작됩니다.',
}
```

브라우저 탭 · 검색 결과 · 카톡 공유 미리보기에 그대로 노출됩니다.

## 1-3. 루트 랜딩에 사업자 정보가 없다 (전자상거래법 제10조)

```
src/app/page.tsx
```

`Footer` 컴포넌트는 이미 있고 `/intro` 에는 붙어 있습니다. 그런데 **실제 첫 화면인 `/` 에는 없습니다.**

- `src/app/page.tsx` 마지막에 `<Footer />` 를 추가하세요
- `/login`, `/signup` 도 마찬가지입니다 — `(auth)/layout.tsx` 에 `<Footer />` 추가

## 1-4. 한글이 fallback 폰트로 렌더된다

```
src/app/layout.tsx
```

Pretendard 를 `<head>` 에서 불러오는데, `<body className={geistSans.variable ...}>` 로
**Geist 가 적용**되고 있습니다. Geist 에는 한글 글리프가 없어 시스템 폰트로 떨어집니다.

- `Geist`, `Geist_Mono` import 와 className 을 제거
- `globals.css` 의 body 에 `font-family: 'Pretendard Variable', Pretendard, -apple-system, sans-serif`

---

# 2. 이모지 전면 제거

프로토타입에는 이모지가 **하나도** 없습니다. 전부 도형 · SVG · 색 배지입니다.

| 파일 | 이모지 | 대체 |
| --- | --- | --- |
| `app/page.tsx` | 📢 ✨ | 제거 (제목만) |
| `app/intro/page.tsx` | 🎉 📅 🎯 💬 🎬 🏢 | 제거 또는 lucide 아이콘 |
| `(auth)/signup/page.tsx` | 🎬 🏢 | 제거 |
| `(auth)/pending/page.tsx` | ⏳ 📋 | 제거 |
| `advertiser/messages/page.tsx` | 💬 (빈 상태) | 아래 3-4 참고 |
| `influencer/messages/page.tsx` | 💬 (빈 상태) | 같음 |
| `advertiser/messages/[id]/page.tsx` | 👥 📎 ⏳ | 캠페인 아바타는 `lucide-react` `Users` 16px |
| `influencer/messages/[id]/page.tsx` | 📎 ⏳ | `Paperclip` / 스피너 |
| `components/messages/ConversationRow.tsx` | 👥 | `Users` 아이콘 |
| `components/messages/MessageBubble.tsx` | 📎 | `Paperclip` 아이콘 |
| `influencer/earnings/page.tsx` | 📥 | `Download` 아이콘 |
| `components/TopBar.tsx` | ⚙️ | `Settings` 아이콘 |

이미 `lucide-react` 를 쓰고 있으니(`AdvertiserShell`) 같은 규격(16px, `strokeWidth={1.75}`)으로 맞추세요.

---

# 3. 대시 — 셸은 PC 인데 페이지가 모바일 폭이다

`AdvertiserShell` / `InfluencerShell` 의 PC 모드는 `min-w-[1360px]` + 사이드바 236px 로 제대로 잡혀 있습니다.
그런데 **페이지 쪽에서 `max-w-lg mx-auto`(512px)로 다시 좁히고** 있어서 화면의 60% 가 빕니다.

## 3-1. 목록 + 대화창 2단

```
src/app/(dashboard)/advertiser/messages/page.tsx        max-w-lg 제거
src/app/(dashboard)/advertiser/messages/[id]/page.tsx   max-w-lg 제거
src/app/(dashboard)/influencer/messages/page.tsx        max-w-lg 제거
src/app/(dashboard)/influencer/messages/[id]/page.tsx   max-w-lg 제거
```

PC 에서는 한 화면에 둘 다 보여야 합니다.

```
왼쪽  대화 목록  320px 고정, overflow-y:auto
오른쪽 대화창    flex:1, min-w-0 — 헤더 / 말풍선(flex-1 overflow-y-auto) / 입력창
```

- 목록에서 고르면 **오른쪽에서 열린다.** 페이지 이동이 아니다
- 라우트는 유지해도 됩니다 — `messages/page.tsx` 를 목록+빈 오른쪽, `messages/[id]` 를 목록+선택된 대화로
  (셸 안에서 같은 2단 골격을 공유)
- 모바일 모드(`max-w-lg`)는 지금 구조가 맞습니다. `[.adv-pc_&]:` 변형으로 갈라주세요
  — `SettlementsView.tsx` 가 이미 그 패턴을 쓰고 있습니다. 그대로 따르면 됩니다
- 아무것도 안 골랐을 때 오른쪽: 「왼쪽에서 대화를 골라주세요」

## 3-2. 캠페인 대화 / 개인 대화 탭

```
src/app/(dashboard)/advertiser/messages/page.tsx
```

주석에 `(D6 A1)` 이 있고 데이터는 이미 `byCampaign` / `byPersonal` 로 나뉘어 있는데,
**렌더에서 한 배열로 합쳐 시간순 정렬**만 하고 있습니다.

- 목록 위에 탭 두 개: `캠페인 대화 N` / `개인 대화 N`
- 탭 스타일은 `SettlementsView` 의 탭과 같은 규격 (`bg-[#F1F1F4] rounded-lg p-[3px]`)
- 인플루언서는 전부 1:1 이므로 탭 없음 (지금이 맞습니다)

## 3-3. 캠페인 대화 헤더에 캠페인 제목

```
src/app/(dashboard)/advertiser/messages/[id]/page.tsx
```

지금 `{isCampaign ? '캠페인 대화' : otherName}` 로 **어느 캠페인인지 안 보입니다.**
`conv.campaign_id` 로 캠페인 제목을 읽어 표시하세요. 목록에서는 제목이 나오는데 방에 들어가면 사라집니다.

## 3-4. 빈 상태

```
advertiser/messages/page.tsx
influencer/messages/page.tsx
```

지금: 💬 + 「아직 대화가 없어요」 — 다음 행동이 없습니다.

- 광고주: 「아직 대화가 없어요」 + 「인플루언서 찾기」 버튼 (`/advertiser/search`)
- 인플루언서: 「아직 대화가 없어요」 + 「오픈 일정 열기」 버튼 (`/influencer/schedule`)

## 3-5. 캠페인 대화에 신고 버튼이 없다

```
src/app/(dashboard)/advertiser/messages/[id]/page.tsx
```

`{!isCampaign && singleProposalId && (...)}` 조건이라 **캠페인 대화에서는 신고할 수 없습니다.**
D6 E4 는 「입구는 대화 헤더 한 곳」이고 캠페인 대화도 대화입니다.

- 캠페인 대화에서는 참여자를 먼저 고르게 하고(이미 참여자 칩이 있음), 그 사람의 `proposalId` 로 신고
- 아무도 안 골랐으면 「먼저 참여자를 선택해주세요」

## 3-6. 캠페인 대화에서 파일을 못 보낸다

```
src/app/(dashboard)/advertiser/messages/[id]/page.tsx
```

`handleFile` 이 `conv.kind === 'campaign'` 이면 즉시 반환하고, 첨부 버튼도 `!isCampaign` 조건입니다.
**가이드 배포는 캠페인 대화에서 전원에게 보내는 것이 기본**입니다.

`sendCampaignMessage` 에 파일 필드를 넘길 수 있게 하고 캠페인 대화에서도 첨부를 여세요.

## 3-7. 날짜 제안 상태가 항상 「live」

```
src/app/(dashboard)/advertiser/messages/[id]/page.tsx
src/app/(dashboard)/influencer/messages/[id]/page.tsx
```

`MessageBubble` 은 `accepted` / `answered` 를 지원하는데, 두 페이지 모두
`dateProposalStatus={msg.proposed_date ? 'live' : null}` 로 하드코딩입니다.
광고주 페이지에는 쓰이지 않는 `dateStatus` 지역변수도 남아 있습니다(dead code).

- proposal 의 확정 날짜와 비교해 `accepted` / 이후 다른 제안이 있으면 `answered` 로 계산
- 수락된 카드에 계속 「상대가 수락하면 확정돼요」가 뜨면 수락이 된 건지 알 수 없습니다

## 3-8. 광고주 대화방에 담당자 이름이 잘못 나온다

```
src/app/(dashboard)/advertiser/messages/[id]/page.tsx
```

```ts
const managerName = conv.manager_id
  ? (conv.manager_id === conv.advertiser_id ? '나' : (nameByInfluencer[conv.manager_id] ?? '담당자'))
  : null
```

`nameByInfluencer` 는 **인플루언서 이름 맵**입니다. 담당자는 팀 멤버(광고주 쪽)이므로 여기서 절대 안 나옵니다.
항상 '담당자' 로 떨어집니다. 팀 멤버 프로필에서 이름을 읽으세요.

---

# 4. 용어 · 상단바 · 표기 규칙

## 4-1. 「메시지」 → 「대시」

```
src/components/AdvertiserShell.tsx        NAV 라벨 '메시지'
src/app/(dashboard)/advertiser/messages/page.tsx    h1 '대화'
src/app/(dashboard)/influencer/messages/page.tsx    h1 '대화'
```

`InfluencerShell` 은 이미 「대시」로 되어 있습니다. 광고주만 「메시지」입니다.
페이지 제목 「대화」도 「대시」로. **화면 어디에도 「메시지」를 쓰지 않습니다.**

입력창 placeholder 「메시지 입력...」도 「대시에 쓸 말을 입력하세요」 등으로.

## 4-2. 상단바 — 계정명이 두 번 나온다

```
src/components/AdvertiserShell.tsx
src/components/InfluencerShell.tsx
src/app/(dashboard)/advertiser/layout.tsx
```

지금 왼쪽에 `{name}`(계정명) + `{sub}`(광고주 콘솔 · 2026년 8월), 오른쪽에 또 아바타.

규칙:
- **왼쪽 = 서비스 이름 + 기간만.** 「광고주 콘솔」 / 「2026년 8월」. 계정명을 쓰지 않는다
- **오른쪽 = 계정 영역.** 별명 + 아바타. 여기가 프로필 · 설정 진입점

`AdvertiserLayout` 이 `name` 을 헤더 왼쪽으로 넘기는 구조를 바꾸고, `sub` 를 두 줄로 나누세요.

## 4-3. 아바타 이니셜이 규칙과 다르다

```
src/components/AdvertiserShell.tsx   {name[0]}
src/components/InfluencerShell.tsx   {name[0]}
```

`lib/initial.ts` 에 규칙 함수가 **이미 있는데 안 쓰고** 첫 글자를 그대로 씁니다.
「테스트 광고주」 → 지금 「테」, 규칙대로면 **「광」**(마지막 어절 첫 글자).

두 셸 모두 `initial(name)` 으로 교체하세요.

## 4-4. 날짜 형식

```
src/app/(dashboard)/advertiser/messages/page.tsx   toLocaleDateString('ko-KR')
src/app/(dashboard)/influencer/messages/page.tsx   같음
src/app/(dashboard)/influencer/earnings/page.tsx   같음
```

「2026. 7. 21.」로 나옵니다. `lib/date.ts` 에 목록용 함수를 추가하고 전부 그것을 쓰세요.

| 언제 | 표기 |
| --- | --- |
| 오늘 | `오후 3:20` |
| 어제 | `어제` |
| 올해 | `7/21` |
| 그 전 | `2025. 7/21` |

## 4-5. 미응답 배지가 남발된다

```
src/components/messages/ConversationRow.tsx
src/app/(dashboard)/influencer/messages/page.tsx
```

`unread` 면 무조건 빨간 「미응답」입니다. 4건 중 3건이 빨강이면 경고가 무의미해집니다.

- **안 읽음** → 검정 원에 숫자 배지
- **내 응답이 2일 이상 없음** → 빨간 「미응답」
- 색 의미 규칙: red = 미응답 · 지연 / amber = 브랜드 · 주 액션 / green = 확정 · 완료

## 4-6. 「수익」 → 「매출」

```
src/components/InfluencerShell.tsx   PC_NAV / MOBILE_TABS 라벨 '수익'
src/app/(dashboard)/influencer/earnings/page.tsx   h1 '매출 관리'
```

사이드바는 「수익」, 페이지는 「매출 관리」로 갈립니다. 용어 규칙은 **매출**입니다.
요약 카드의 「예정 수입」도 「예정 매출」로.

## 4-7. 로고 표기

```
src/components/TopBar.tsx              MatchPost
src/app/page.tsx                       MatchPost
src/app/intro/page.tsx                 MatchPost
src/app/(auth)/login/page.tsx          MatchPost
src/app/(auth)/signup/page.tsx         MatchPost
src/app/(auth)/pending/page.tsx        MatchPost
src/components/InfluencerShell.tsx     MatchPost (모바일 헤더)
```

콘솔 사이드바는 마크 + `MATCH·POST`(Archivo 900) 로 통일되어 있는데, 나머지는 「MatchPost」 텍스트입니다.

- 로고 컴포넌트 하나(`components/Logo.tsx`)를 만들어 전부 그것을 쓰세요
- 점(`·`)은 amber `#F59E0B`, 세로 중앙, 좌우 같은 여백

## 4-8. PC / 모바일 토글 제거

```
src/components/AdvertiserShell.tsx
src/components/InfluencerShell.tsx
```

`modeToggle` 은 개발용입니다. 사용자에게 보일 것이 아닙니다.

- 토글 UI 를 제거하고 userAgent · 화면폭 자동 감지만 남기세요
- `localStorage` 의 `advViewMode` / `infViewMode` 도 함께 제거

## 4-9. 사이드바 그룹

```
src/components/AdvertiserShell.tsx   그룹 '운영' 하나
src/components/InfluencerShell.tsx   그룹 '활동' 하나
```

프로토타입은 실제 순환대로 나눕니다.

광고주:
```
캠페인 열기   대시보드 · 캠페인
사람 찾기     인플루언서 · 내 인플루언서
이야기하기    대시
정산하기      정산 · 크레딧
계정          팀 멤버 · 알림
```

인플루언서:
```
일정 열기     홈 · 오픈 일정
기회 찾기     캠페인 찾기
이야기하기    대시
성과 보기     내 채널 · 매출
계정          알림
```

`connections`(내 인플루언서) 라우트가 있는데 광고주 NAV 에 빠져 있습니다. 추가하세요.

---

# 5. 스키마와 화면이 어긋난 것

## 5-1. 광고주 사업자 정보를 받지 않는다

```
src/app/(auth)/signup/page.tsx
src/app/api/signup/route.ts
```

가입 폼이 받는 것: 이름 · 이메일 · 전화 · 담당자 휴대폰 · 회사 대표번호 · 비밀번호.
**상호 · 사업자등록번호 · 사업자등록증 파일이 없습니다.**

그런데:
- `advertiser/layout.tsx` 는 `advertiser_profiles.company_name` 을 읽습니다 → 항상 비어 있음
- `/pending` 은 「관리자가 서류를 확인한 후 승인」이라 말합니다 → 확인할 서류가 없음
- `admin/users` 는 승인 심사를 전제합니다 → 판단 근거가 없음

가입 폼에 추가하세요:

| 필드 | 필수 | 비고 |
| --- | --- | --- |
| 상호 | 필수 | `advertiser_profiles.company_name` |
| 사업자등록번호 | 필수 | 000-00-00000 |
| 사업자등록증 파일 | 필수 | 확인 즉시 삭제 (5-2) |
| 사업장 주소 | 선택 | |

> 값은 나중에 넣으셔도 됩니다. **입력란과 저장 경로**만 먼저 만들어두면 됩니다.

## 5-2. 자격 확인 서류 자동 삭제 (약관 제17조 ⑤ · 처리방침 4절 ⑤)

```
src/app/api/cron/purge-attachments/route.ts  (지금은 chat-files 만 처리)
src/app/admin/users/page.tsx                  (승인 시 삭제)
```

대시 첨부(7일)는 이미 됩니다. **자격 확인 서류는 규칙이 다릅니다.**

- 관리자가 **승인/반려하는 즉시** 서류 원본 삭제
- 확인 결과와 사업자등록번호만 보관
- 확인이 지연되어도 **제출일로부터 30일** 이면 자동 삭제
- `purge-attachments` 에 이 버킷 규칙을 추가하거나 별도 cron 으로

**이미 약관과 처리방침에 공개한 내용입니다.** 구현되지 않으면 방침 위반입니다.

## 5-3. 매출 상태값이 겹친다

```
src/app/(dashboard)/influencer/earnings/page.tsx
```

`STATUS_FILTERS = ['전체', '예정', '진행중', '완료', '결제완료']` —
「완료」와 「결제완료」가 무엇이 다른지 화면에서 구분되지 않습니다. `statusColor` 도 둘을 다르게 칠합니다.

정산 쪽 용어(`예정 / 미수 / 완료`)와 맞추세요. 광고주 화면과 인플루언서 화면이 같은 건을
다른 이름으로 부르면 안 됩니다.

## 5-4. 미수 카드에 D+ 와 금액이 없다

```
src/app/(dashboard)/influencer/earnings/page.tsx
```

지금 「정산 예정일 2026-08-01이 지났어요」뿐입니다. 광고주 화면·관리자 화면은 D+ 와 금액을 보여줍니다.
D6 C6 은 **세 화면이 같은 값을 보여야 한다**고 정했습니다.

- `dDayLabel(settlementDate)` 로 D+ 표시 (`lib/date.ts` 에 이미 있음)
- 금액(`budget`) 표시
- 「지연 알림 N회 발송」도 함께 (광고주에게 실제로 가고 있다는 사실)
- 날짜 형식도 `2026-08-01` 이 아니라 `8/01`

---

# 6. 확인 체크리스트

`pgae.tsx` 같은 오류는 빌드가 잡지 않습니다. **라우트를 하나씩 열어보세요.**

로그인 전
- [ ] `/` — 제목 「매치포스트」, 하단 사업자 정보, 이모지 없음
- [ ] `/intro` — `/` 와 중복인지 판단 (둘 중 하나로 정리)
- [ ] `/login` `/signup` — 하단 사업자 정보
- [ ] `/terms` `/privacy`

광고주
- [ ] `/pending` — **가입 직후 실제로 도달하는지**
- [ ] `/advertiser/dashboard`
- [ ] `/advertiser/campaigns` `/campaigns/new` `/campaigns/[id]`
- [ ] `/advertiser/messages` — 2단인지, 탭이 있는지, 빈 상태에 다음 행동이 있는지
- [ ] `/advertiser/messages/[id]` — 캠페인 제목, 신고 버튼, 파일 첨부
- [ ] `/advertiser/search` — 대시 보내기 날짜 선택
- [ ] `/advertiser/connections` — 사이드바에서 갈 수 있는지
- [ ] `/advertiser/settlements` `/advertiser/team` `/advertiser/notifications`
- [ ] `/advertiser/proposals` `/proposals/new` — `/search` 와 역할이 겹치는지 판단

인플루언서
- [ ] `/influencer/dashboard` `/influencer/schedule` `/schedule/list`
- [ ] `/influencer/messages` `/messages/[id]` — 2단, 단체 발송 배지
- [ ] `/influencer/earnings` — 미수 카드에 D+ · 금액
- [ ] `/influencer/search` `/influencer/profile` `/influencer/channel-analytics`
- [ ] `/influencer/proposals` `/influencer/notifications`

관리자
- [ ] `/admin/dashboard` `/admin/users`(승인 버튼) `/admin/credits` `/admin/credits/policy`
- [ ] `/admin/reports` `/admin/reports/[id]` `/admin/sanctions`

공통
- [ ] `/credits` `/credits/about` `/profile` `/profile/[id]` `/influencer/[id]` `/day/[date]`
- [ ] 배치 11개가 실제로 스케줄에 등록됐는지 (`api/admin/batch/*`)

---

# 7. 랜딩 · 로그인 · 가입은 부록에 명세가 있습니다

`D7-APPENDIX-LANDING-SIGNUP.md` — 색 · 크기 · 문구를 값으로 다 적었습니다.
**프로토타입을 열지 않고도 만들 수 있습니다.** 그 문서를 그대로 따르세요.

담긴 것: 로고 컴포넌트(점 규격 포함) · 랜딩 2단 구성 · 3포인트 문구 · 소셜 버튼 색 ·
역할 탭 · 배경 격자 값 · 광고주 가입 3단계 전 필드 · 인플루언서 QR 모달 · 모바일 5단계 ·
로그인 · 승인 대기.

## 프로토타입을 열어야 하는 것 (부록에 없는 것)

| 확인할 것 | 프로토타입 |
| --- | --- |
| 대시 2단 · 참여자 칩 · 배지 위치 | `advertiser-mypage-pc.dc.html` → 대시 |
| 사이드바 그룹 순서 | 같은 파일 |
| 단체 발송 배지 · 1:1 안내 | `influencer-mypage-pc.dc.html` → 대시 |
| 정산 3탭 (이미 일치 — 참고만) | `advertiser-mypage-pc.dc.html` → 정산 |

---

# 8. 이 문서가 다루지 못한 것 (정직하게)

제가 **코드는 읽었지만 눌러보지 못한** 화면입니다. 로그인 뒤라 접근할 수 없었습니다.
빌드 후 직접 확인해 어긋난 것이 있으면 알려주세요.

| 화면 | 파일 | 크기 |
| --- | --- | --- |
| 딜시트 | `src/components/DealSheet.tsx` | 36KB |
| 캠페인 등록 | `advertiser/campaigns/new/page.tsx` | 65KB |
| 광고주 대시보드 | `advertiser/dashboard/page.tsx` | 23KB |
| 인플루언서 홈 | `influencer/dashboard/page.tsx` | 28KB |
| 블로그 분석 | `components/BlogAnalyticsCard.tsx` | 14KB |
| 확정 바 | `components/DealConfirmBar.tsx` | 15KB |
| 캠페인 달력 | `components/CampaignCalendar.tsx` | 15KB |

이 파일들에도 이 문서에서 지적한 **공통 결함이 있을 가능성이 높습니다.** 각 파일에서 확인하세요:

- [ ] `max-w-lg` 로 PC 폭을 좁히고 있지 않은지 (3절)
- [ ] 이모지가 있는지 (2절)
- [ ] `toLocaleDateString('ko-KR')` 을 쓰는지 (4-4)
- [ ] `name[0]` 로 이니셜을 만드는지 (4-3)
- [ ] 「메시지」 「수익」 「제안」 같은 용어를 쓰는지 (4-1, 4-6)
- [ ] 금액을 하드코딩하는지 (`creditConfig.ts` 를 쓰는지)
- [ ] 날짜 계산을 `lib/date.ts` 없이 하는지

**전체 grep 으로 한 번에 찾을 수 있습니다:**

```bash
grep -rn "max-w-lg" src/app src/components
grep -rn "toLocaleDateString" src/app src/components
grep -rn "name\[0\]" src/components
grep -rn "메시지\|수익\|제안서" src/app src/components
grep -rnP "[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}]" src/app src/components
```
