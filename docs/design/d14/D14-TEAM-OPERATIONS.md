# D14 — 팀 운영 기능 (모드 전환 · 업무 현황 · 휴무 · 이관)

대상: `umph112/matchpost@main` · tree `e2d7c7186702` (2026-08-18 확인)
방법: `HANDOFF-RULES.md` 절차 — 「신설」 전에 `sql/migrations/` 전체와 `src/lib/` 를 먼저 검색했습니다.

---

# 0. 지난 프롬프트 확인표

| 프롬프트 | 확인한 것 | 판정 |
| --- | --- | --- |
| 9 ① 대표 이메일 + `marketing_email` | `api/signup/route.ts:108` | **반영** |
| 9 ② 전화 라벨 swap 안 함 | 라벨 그대로 | **반영** (지시대로) |
| 8 [1] 약관 제5조 | 「담당자 한 명」 검색 0건 | **반영** |
| 8 [3] 팀 페이지 4건 | `team/page.tsx:314` roleLabel · 「비활성화」 0건 | **반영** |
| 8 인플루언서 문구 | 화면 문구에서 「본인인증」 0건 (주석만) | **반영** |

전부 들어갔습니다. **이 문서는 새 기능입니다.**

---

# 1. 선행 조건 — `campaigns.manager_id` (이것부터)

2~5절 전부가 이 컬럼에 걸려 있습니다. **없으면 아무것도 못 만듭니다.**

`sql/migrations/` 전체를 검색했습니다 — `campaigns` 에 `manager_id` **없음**(0건).
`manager_id` 는 `conversations`(0065)에만 있고 그건 대화 담당으로 별개입니다.

```sql
-- sql/migrations/0083_campaigns_manager.sql
alter table campaigns add column if not exists manager_id uuid references profiles(id);
comment on column campaigns.manager_id is
  '이 캠페인의 담당 팀원. 대표가 만들면 대표 id. 이관·대행의 단위가 된다.';

-- 기존 행은 회사 대표(advertiser_id)를 담당으로 본다
update campaigns set manager_id = advertiser_id where manager_id is null;

create index if not exists campaigns_manager_idx on campaigns (manager_id);
```

**함께 해야 하는 것 — 팀원이 로그인하면 회사 데이터를 본다**

지금 팀원은 초대 링크로 가입해 로그인할 수 있는데(`api/team/accept`), 로그인 후 무엇을 보는지가
배선돼 있지 않습니다. 초대받아 가입한 사람이 빈 화면을 볼 가능성이 높습니다.

- 팀원의 `advertiser_id` = 소속 회사 (자기 id 가 아니다)
- 캠페인 목록 · 대시 · 정산은 **회사 것을 보되 기본 필터가 「내 담당」**
- 팀원이 캠페인을 만들면 `advertiser_id` = 회사, `manager_id` = 그 팀원
- 크레딧은 **회사 잔액**에서 차감하고 원장에 「누가」를 남긴다

---

# 2. 모드 전환 — 내 업무 / 회사 관리

프로토타입: `advertiser-mypage-pc.dc.html` 상단바

대표는 **직접 캠페인도 운영하고 회사도 관리**합니다. 한 화면에 섞으면 자기 건을 찾기 어렵고,
계정을 나누면 로그인을 두 번 해야 합니다. 그래서 **한 계정 · 두 모드**입니다.

## 2-1. 상단바 토글

```
위치: 상단바 · 로고 오른쪽 (계정 영역 왼쪽)
묶음: background:#F1F1F4 · border-radius:9px · padding:3px · gap:2px
칩:   font-size:11.5px · padding:5px 11px · border-radius:6px · white-space:nowrap
      선택   font-weight:700 · background:#fff · color:#17171B · box-shadow:0 1px 2px rgba(0,0,0,0.06)
      미선택 font-weight:600 · color:#7C7C88
```

- 칩 두 개: **내 업무** / **회사 관리**
- 기본값은 **내 업무**. 1인 대행사는 대표가 곧 실무자다
- **팀원 계정에는 토글이 없다.** 「내 업무」만 존재
- **팀원이 없는 대표에게도 토글을 보이지 않는다** (활성 팀원 0명)

## 2-2. 모드별로 달라지는 것

| | 내 업무 | 회사 관리 |
| --- | --- | --- |
| 사이드바 | 대시보드 · 캠페인 · 인플루언서 · 대시 · 딜시트 · 정산 | **+ 팀 · 크레딧** |
| KPI · 목록 | `manager_id = 나` | 담당자 필터 (전체 / 팀원별) |
| 담당자 필터 | 없음 | 상단에 별도 줄 |
| 본문 안내 | 없음 | 「회사 전체를 보고 있어요 — 팀원이 담당하는 건도 함께 나옵니다」 |

⚠️ **팀 · 크레딧 메뉴는 회사 관리 모드에만** 둡니다. 회사 단위 값이라 내 업무에 있으면
「내 크레딧인가」로 읽힙니다.

## 2-3. 담당자 필터 (회사 관리 모드 안)

```
src/lib/team/viewShare.ts (신규 — src/lib 검색 0건)
```

```ts
export async function viewShare(advertiserId: string, viewAs: string): Promise<{
  camps: number; campsNew: number; infl: number; talking: number;
  spend: number; waiting: number; respHours: number;
}>
```

| `viewAs` | 범위 |
| --- | --- |
| `'me'` | `campaigns.manager_id = 로그인 id` |
| 팀원 id | `campaigns.manager_id = 그 id` |
| `'all'` | `campaigns.advertiser_id = 회사` (전원 합산) |

**⚠️ 라벨만 바뀌고 숫자가 그대로면 안 됩니다.** 함께 바뀌어야 하는 것:

- KPI 4칸 + 각 부제
- 페이지 부제 (`<h1>` 아래)
- 최근 캠페인 · 대시 · 딜시트 목록

**⚠️ `'all'` 은 팀원별 합산이어야 합니다.** 따로 계산하면 합이 안 맞습니다.
**⚠️ 평균 응답 시간만 합이 아니라 건수 가중 평균**입니다 — 6+4+9=19시간이 되면 안 됩니다.

```
respHours = round( Σ(respHours_i × camps_i) / Σ(camps_i) )
```

필터 목록은 **`team_members` 에서 파생**시키세요 (`role='팀원' and status='활성'`).
따로 적었더니 프로토타입에서 필터엔 「이서연」, 팀 목록엔 「김서연」이 있었습니다.

---

# 3. 팀원 업무 현황 (신규 화면)

프로토타입: `team-workload.dc.html`

**왜** — 3명만 있어도 눈치보며 노는 사람과 일을 다 떠안는 사람이 갈립니다.
대표가 그걸 모르면 열심히 하는 직원을 잃습니다. 그리고 **새 캠페인을 누구에게 맡길지 고를 때의 자료**입니다.

## 3-1. 위치

```
회사 관리 모드 → 팀 페이지 안의 탭 — 「멤버」 / 「업무 현황」
```

- 멤버는 드물게 하는 일(초대·해제), 업무 현황은 자주 보는 것 → 탭으로 나눔
- 별도 메뉴로 빼면 사이드바가 늘고, 멤버 목록에 섞으면 초대 화면이 무거워진다
- **회사 관리 대시보드에 한 줄 요약 카드** — 막힌 건이 있는 사람만 이름·건수로. 누르면 이 탭으로

⚠️ **팀원 화면에 이 경로가 없어야 합니다.** 평가받는 곳이 되면 기록을 정확히 남기지 않게 되고
데이터 전체가 망가집니다.

## 3-2. 골격

```
머리: h1 「팀원 업무 현황」 + 「대표만 보임」 배지(background:#17171B · color:#fff · 10px/800)
      부제 「누가 얼마나 들고 있고 어디가 막혀 있는지 봅니다. 점수를 매기지 않아요 — 숫자를 나란히 놓을 뿐입니다.」
      우측 기간 탭 (이번 달 / 지난 달 / 분기)

안내 박스: background:#FBFBFC · border:1px solid #EFEFF2 · radius:11px · padding:12px 14px
  「담당 건수를 항상 함께 보세요. 처리 건수만 보면 적게 맡은 사람이 유리하고,
   담당 건수만 보면 쌓아둔 사람이 유리합니다. 지연은 건수가 아니라 비율입니다.」

사람당 카드: background:#fff · border:1px solid #EAEAEE · radius:14px
  헤더 padding:15px 20px · border-bottom:1px solid #F1F1F4
    아바타 38px + 이름 14.5px/700 + 역할 배지 + 휴무 배지(있으면)
    우측: 한 줄 요약 배지 + 「화면 보기 →」
  본문 grid-template-columns:repeat(4,minmax(0,1fr)) · 각 칸 padding:15px 18px
    칸 사이 border-right:1px solid #F1F1F4 (마지막 제외)
```

## 3-3. 네 절 (읽는 순서)

| 절 | 점 색 | 값 |
| --- | --- | --- |
| ① 지금 들고 있는 것 | `#F59E0B` | 담당 캠페인 N건 · 담당 인플루언서 N명 · 진행 중 대화 N건 |
| ② {기간} 처리한 것 | `#22C55E` | 완료 N건 · 정산 기록 N건 · 신규 등록 N건 |
| ③ 막혀 있는 것 | `#EF4444` | **지연율 N% (N/N)** · 미응답 2일+ N건 · 미수 N건 |
| ④ 상대가 본 것 | `#3B82F6` | **인플루언서 평가 N.N (N건)** · 평균 응답 N시간 |

```
절 제목 11px/800 · #9A9AA5 · letter-spacing:0.02em
행 라벨 11.5px · #7C7C88 / 값 13.5px/800 · letter-spacing:-0.02em · tabular-nums
값 색  나쁨 #DC2626 · 좋음 #15803D · 기본 #17171B
괄호 원자료 10.5px · #B0B0BB
```

**⚠️ 지연은 비율입니다.** 건수로 보면 많이 맡은 사람이 불리해집니다.
원자료를 괄호로 함께 — 「100% (2/2)」와 「20% (2/10)」은 다른 이야기입니다.

**⚠️ 평가는 평균 + 건수**입니다. 1건에 5.0 은 아직 판단할 근거가 아닙니다.

## 3-4. 한 줄 요약 배지

```
막힌 건 있음  background:#FEE2E2 · color:#DC2626   (미응답 2건+ 또는 지연율 50%+ 또는 응답 12시간+)
가장 많이 맡음 background:#FEF3C7 · color:#B45309   (담당 건수가 최대)
여유 있음     background:#F1F1F4 · color:#7C7C88
11px/700 · border-radius:5px · padding:4px 9px
```

**잘한다·못한다를 말하지 않습니다.** 「많이 들고 있다」와 「막혀 있다」만 말합니다.
배정할 때 「여유 있음」을 먼저 보게 되는 것이 이 배지의 목적입니다.

## 3-5. 화면 맨 아래 「이 화면을 읽는 법」

5줄을 그대로 넣으세요. 마지막 줄이 중요합니다.

```
· 담당 건수와 처리 건수를 함께 보세요. 한쪽만 보면 적게 맡은 사람이나 쌓아둔 사람이 유리해집니다.
· 지연율은 담당 건수로 나눈 값입니다. 「2건 중 2건 지연(100%)」과 「10건 중 2건 지연(20%)」은 다른 이야기입니다.
· 평가는 평균과 건수를 함께 봅니다. 1건에 5.0 은 아직 판단할 근거가 아닙니다.
· 이 화면은 대표만 봅니다. 팀원 화면에는 나타나지 않아요 — 평가받는 곳이 되면 기록을 정확히 남기지 않게 됩니다.
· 숫자가 나쁜 사람이 일을 못 하는 것이 아닐 수 있습니다. 어려운 건을 맡았는지, 휴무였는지는 대표가 압니다.
```

## 3-6. 캠페인 등록에서 이어지는 링크

```
src/app/(dashboard)/advertiser/campaigns/new/page.tsx
```

담당자를 고르는 자리에 「팀원 업무 현황 보기 →」를 둡니다.
**과부하인 사람에게 또 맡기면 그 건이 막힙니다.** 판단이 필요한 자리에 자료가 손에 있어야 쓰입니다.

---

# 4. 휴무 · 대행 (신규)

프로토타입: `leave-request.dc.html` (상단 토글로 팀원/대표 두 화면)

## 4-1. 왜

지금 담당자가 휴가인데 인플루언서는 답을 기다리고, 대표도 모릅니다.
대리 발송 배너에 「담당자가 휴가 중이라」가 이미 사람 말로 들어가 있습니다 — 시스템이 모르는 것입니다.

**인플루언서가 답을 기다리다 지치는 것을 막는 게 목적**입니다. 인사 기능이 아닙니다.

## 4-2. 스키마

`sql/migrations/` 전체 검색 — 휴무 테이블 **없음**(0건).

```sql
-- sql/migrations/0084_leaves.sql
create table if not exists leaves (
  id            uuid primary key default gen_random_uuid(),
  advertiser_id uuid not null references profiles(id) on delete cascade,
  member_id     uuid not null references profiles(id) on delete cascade,
  from_date     date not null,
  to_date       date not null,
  kind          text not null check (kind in ('연차','반차','병가','기타')),
  reason        text,
  status        text not null default 'pending'
                check (status in ('pending','rejected','replied','approved','done')),
  substitute_id uuid references profiles(id),
  created_at    timestamptz not null default now()
);
create index on leaves (advertiser_id, from_date);

-- 반려 메모와 답이 쌓인다 — 한 번 반려로 끝내지 않는다
create table if not exists leave_notes (
  id        uuid primary key default gen_random_uuid(),
  leave_id  uuid not null references leaves(id) on delete cascade,
  author_id uuid not null references profiles(id),
  text      text not null,
  at        timestamptz not null default now()
);
```

## 4-3. 흐름

```
팀원 신청 → 대표 수락 + 대행자 지정 → 시작 전날 알림 → 휴무 중 대행 표기 → 복귀 자동 원복
                ↓ 반려 + 메모
           팀원 답 → 대표 재판단
```

**대행자의 수락 절차를 두지 않습니다.** 대행은 떠안는 것이 아니라 서포트이고, 본인도 계속 처리합니다.
거절 단계를 두면 휴무 시작만 늦어집니다.

## 4-4. 팀원 신청 화면

```
본문: grid-template-columns:minmax(0,1fr) 340px · gap:14px · align-items:start
좌: 달력 카드 (repeat(7,1fr) gap:4px · 칸 aspect-ratio:1 · radius:9px)
우: 신청 폼
```

**달력 칸 — 출처를 선으로 구분합니다 (색이 아니라)**

| 상태 | 배경 | 테두리 | 글자 |
| --- | --- | --- | --- |
| 내가 고른 범위 | `#FFFBEB` | `1.5px dashed #F59E0B` | 700 · `#B45309` |
| 이미 수락된 팀원 휴무 | `#EFF6FF` | `1.5px solid #93C5FD` | 700 · `#1D4ED8` + 이니셜 9px |
| 오늘 | `#F1F1F4` | `1px solid transparent` | 700 · `#17171B` |
| 그 외 | 없음 | `1px solid transparent` | 500 · `#9A9AA5` |

두 번 눌러 기간을 고릅니다(거꾸로 눌러도 됨). 아래에 범례 3개.

**신청 폼**
```
고른 날짜   15px/800 · letter-spacing:-0.025em · tabular-nums  「8월 21일 – 22일 (2일)」
종류        칩 4개 (연차 / 반차 / 병가 / 기타) · height:32px · padding:0 13px · radius:8px
            선택 background:#17171B color:#fff / 미선택 background:#F6F6F7 color:#5C5C68
한 줄 사유  선택 · height:44px · radius:10px
```

**⚠️ 「이 기간에 걸린 일」을 그 자리에서 보여줍니다.**
```
background:#FFFBEB · border:1px solid #FDE68A · radius:10px · padding:12px 13px
제목 11px/800 · #B45309
행: 날짜(10.5px/700 · #B45309 · width:38px) + 내용(11.5px · #92400E)
  8/20  성수 델리카페 게재 마감 2건
  8/21  뷰티하는 지연 · 무응답 3일
  8/22  여름 콜드브루 정산 예정일
꼬리말 「대표가 수락할 때 대행자를 지정해줘요. 휴무 중에도 원하면 본인이 직접 처리할 수 있습니다.」
```

모르고 신청하면 나중에 문제가 됩니다. 쿼리 — 그 기간에 걸친 `manager_id = 나` 의
마감(`campaigns.due`) · 미응답 대화 · 정산 예정일.

## 4-5. 대표 수락 화면

```
우측에 「수락 대기 N건」 카드 (border · 헤더 background:#FFFBEB)
```

- 신청 내용 + **걸린 일 요약**
- **대행자 후보에 부담을 함께** — 「담당 6건 · 가장 많이 맡음」 / 「담당 2건 · 여유 있음」
  (3절 업무 현황에서 파생. 후보는 활성 팀원 + 대표 자신)
  ```
  행 height:46px · radius:10px · padding:0 13px
  선택 border-color:#F59E0B · background:#FFFBEB / 미선택 border-color:#E2E2E8
  부담 배지 10.5px/700 · 많음 #FEF3C7/#B45309 · 여유 #F1F1F4/#7C7C88
  ```
- **대행자를 고르지 않으면 수락 버튼 비활성** (`background:#EAEAEE · color:#B0B0BB`,
  라벨 「대행자를 골라주세요」). 걸린 일이 0건이면 예외로 허용
- 안내 「대행은 이관이 아니에요. 휴무 기간에만 그 대화에 들어가고 끝나면 자동으로 빠집니다.」

## 4-6. 반려는 질문이다

```
「반려하고 묻기」 → 모달 (480px · z-index 60 · 오버레이 rgba(23,23,27,0.45) · padding 40px)
  제목 「무엇이 걸리는지 알려주세요」
  안내 「반려는 거절이 아니라 질문이에요. 박도현님이 답하면 다시 판단할 수 있습니다.」
  textarea (min-height:96px)
  보내기 — 메모가 비면 비활성 (background:#EAEAEE)
         활성 background:#DC2626 · color:#fff
```

| 상태 | 카드 제목 | 팀원 화면 |
| --- | --- | --- |
| `pending` | 수락 대기 N건 | 신청 버튼 |
| `rejected` | **답변 대기 1건** | 대표 메모 + 답 입력 + 「답하고 다시 올리기」 |
| `replied` | **다시 판단 1건** | 「답을 보냈어요. 대표가 다시 판단합니다.」 |

메모는 그 신청에 쌓입니다 — 대표 사유는 회색(`#F6F6F7`), 팀원 답은 노란 박스(`#FFFBEB`/`#FDE68A`).
**지금 누가 공을 갖고 있는지 카드 제목이 말합니다.**

## 4-7. 휴무 중 · 복귀

- 대행자는 그 대화에 **참여자로 들어가고, 기간이 끝나면 자동으로 빠집니다**
  (담당을 넘기지 않고 접근만 여는 방식이라 원복이 깨끗합니다)
- 대행자가 쓴 것은 **「{담당자}님 대행」**으로 남습니다 (기존 대리 발송 규칙 재사용)
- 대화 헤더에 「휴무 중 · 대행 {이름}」
- **인플루언서 쪽** — 「담당자가 8월 23일까지 휴무라 답이 늦을 수 있어요. 급하면 {대행자}님에게도 연락됩니다」
  (담당자가 사라진 게 아니라 느려질 수 있다는 안내)
- 빠질 때 대화에 시스템 줄 — 「{대행자}님의 대행이 끝났어요」
- 대행 중 새로 성사된 협업의 담당은 **원래 담당자**
- 복귀 시 팀원 화면 상단에 「대행이 도운 것 N건」 카드 — 읽고 「확인」으로 닫음
- 휴무는 **회사 캘린더와 대표 대시보드**에 함께 표시

---

# 5. 인수인계와 이관 (재설계 — 기존 지시 대체)

프로토타입: `work-transfer.dc.html` (상단 토글로 세 역할)

## 5-1. 퇴사는 세 상태를 지난다

| 상태 | 계정 | 이관하는 사람 | 근거 |
| --- | --- | --- | --- |
| 활동중 | 살아 있음 | — | — |
| **인수인계 중** (퇴사 예정 · 기본) | 살아 있음 | **퇴사자 본인** | 사람이 쓴 메모 + 시스템 요약 |
| 비활성 (인수인계 없이 떠남) | 닫힘 | 대표가 대신 | 시스템 요약뿐 |

**⚠️ 퇴사자가 직접 이관하는 것이 기본입니다.** 대표가 대신하는 것은 예외 경로입니다.
실무는 인수인계를 거쳐 퇴사하고, 맥락을 가진 사람이 옮기는 것이 정확합니다.

## 5-2. 스키마

```sql
-- sql/migrations/0085_offboarding.sql
alter table team_members add column if not exists leave_on date;
comment on column team_members.leave_on is '퇴사 예정일. 대표가 합의 결과를 기재한다. 지나면 대표가 대신 이관.';

-- status 에 '퇴사 예정' 추가 (기존 제약 확인 후 확장)

create table if not exists transfers (
  id           uuid primary key default gen_random_uuid(),
  from_id      uuid not null references profiles(id),
  to_id        uuid not null references profiles(id),
  kind         text not null check (kind in ('campaign','conversation')),
  ref_id       uuid not null,
  memo         text,
  by_id        uuid not null references profiles(id),   -- 퇴사자 본인 or 대표
  at           timestamptz not null default now()
);
create index on transfers (to_id, at desc);
```

## 5-3. 팀 페이지 조치 — 「해제」가 아니라 「퇴사 예정으로 전환」

```
src/app/(dashboard)/advertiser/team/page.tsx
```

지금 「해제」가 첫 단계인데, 그러면 인수인계 기간이 사라집니다.

- 조치 라벨 → **「퇴사 예정으로 전환」** + **퇴사 예정일** 입력
- 대표가 기재하는 것은 **예정일 하나**뿐입니다 (받는 사람을 미리 지정하지 않음)
- 예정일까지 계정은 살아 있고 평소처럼 일합니다
- 전부 이관되면 **자동 비활성** (대표가 따로 해제를 누르지 않아도 됨)

**⚠️ 받는 사람을 미리 못박지 마세요.** 인수인계는 분야·거래처별로 갈립니다 —
한 명에게 몰아줄 수도, 캠페인별로 여러 팀원에게 나눌 수도 있어야 합니다.

## 5-4. 퇴사자 화면 (인수인계)

```
h1 「내 담당 인수인계」
배지 「퇴사 예정 · 8월 29일 (D-7)」 background:#FEF3C7 · color:#B45309
안내 「8월 29일까지는 평소와 똑같이 일하면 돼요. 그날 전에 마무리할 건은 끝내고,
      넘길 건만 이관해주세요. 건마다 받는 분을 따로 고를 수 있고,
      남긴 메모는 그분에게 그대로 전달됩니다.」
```

- 캠페인 행에 **「이관하기」** 버튼 → 받는 사람 선택 + **메모** 입력
- 상단에 **「남은 N건 한 사람에게」** (한 번에 몰아주기)
- 마무리할 건은 이관하지 않고 그대로 진행

**메모가 핵심입니다.** 시스템이 못 쓰는 것이 여기 담깁니다:
```
「광고주 박도현 과장이 결제 담당인데 8월 말까지 휴가예요. 대표번호로 걸면 안 받으니
 담당자 휴대폰으로 연락하세요.」
「뷰티하는 지연님은 전화를 안 받고 카톡으로만 연락됩니다. 원고 독촉은 오후에 하는 게 답이 빨라요.」
```

## 5-5. 받는 사람 화면

**내 페이지는 그대로 두고 그 위에 한 줄 얹습니다.** 내 일이 가려지면 안 됩니다.

```
이관 배너: background:#FFFBEB · border:1px solid #FDE68A · radius:12px · padding:16px 18px
  배지 「이관」 10px/800 · background:#F59E0B · color:#17171B · letter-spacing:0.03em
  제목 14px/800 · letter-spacing:-0.02em · color:#92400E
  설명 12px · color:#B45309 · line-height:1.65
  「이관내역 보기 →」 검정 버튼 (height:40px · radius:10px)
  「이관 기록」 링크 (11.5px/700 · #B45309 · 밑줄)
```

- 제목 「홍길동님 담당 12건이 넘어오는 중이에요」
- 설명 「홍길동님이 8월 29일 퇴사 예정이에요. 12건 중 3건이 넘어왔고, 나머지는
  홍길동님이 메모와 함께 보내줍니다. 기다리지 않고 직접 가져올 수도 있어요.」
- **진행률만** 보입니다. 남의 페이지를 상시 들여다볼 필요는 없습니다

## 5-6. 「이관내역 보기」 화면

**퇴사자가 보던 화면과 같습니다.** 차이는 버튼 하나뿐입니다 — 맥락이 거기 있으니
화면을 다시 만들면 그 맥락이 사라집니다.

| 누르는 사람 | 캠페인 행 | 대화 행 |
| --- | --- | --- |
| 퇴사자 본인 | 「이관하기」 | 「대표에게 이관」 |
| 받는 사람 | 「나에게 이관」 | 「대표에게 이관」 |
| 대표(기간 만료 후) | 「대신 이관」 | 「내가 보관」 |

상단에 **「남은 N건 전부 이관」** (amber). 전부 이관되면 이 페이지가 닫히고 사이드바에서도 사라집니다.

**메모와 시스템 요약을 구분해 보여줍니다:**
```
메모  background:#FFFBEB · border:1px solid #FDE68A · 라벨 「인수인계」 10px/800 #B45309
      본문 11px · #92400E
요약  background:#FBFBFC · border:1px solid #EFEFF2 · 라벨 「어디까지」 10px/800 #9A9AA5
      본문 11px · #5C5C68
```

메모가 없을 때 시스템 요약이 유일한 근거입니다. 섞으면 무엇을 믿을지 모릅니다.

## 5-7. 대화 분류 — 자동으로 갈린다

| 대화 | 어디로 |
| --- | --- |
| 캠페인이 붙은 대화 | **그 캠페인 담당자에게** — 캠페인과 함께 따라감. 이관 목록에 따로 안 나옴 |
| 아직 캠페인이 안 붙은 개인 대화 | **대표 보관** |

대시로 시작된 개인 대화는 협의를 거쳐 진행되면 그 캠페인 대화로 편입됩니다.
그래서 대화는 언제나 캠페인 하나에 붙어 있고, 진행 중인 것도 하나입니다.

개인 대화를 대표가 보관하는 이유 — 친구 등록·답 없는 대시는 **회사 자산**입니다.
없애기도 애매하고 특정 팀원에게 주면 근거가 없습니다.

캠페인 행에 「대화 N건 포함」을 표시하고, 대화 카드 안내는:
```
「캠페인에 엮인 대화는 여기 없어요 — 캠페인과 함께 따라갑니다.
 여기는 캠페인과 무관한 개인 대화이고, 회사 자산이라 대표가 보관합니다.」
```

## 5-8. 꼬리표는 옮긴 뒤에도 남는다

```
배지 「이관」 9.5px/800 · background:#FEF3C7 · color:#B45309 · radius:4px · padding:2px 5px
그 아래 출처 10.5px · #B45309  「홍길동님에게서 8/14 이관」
```

배지만 있으면 누구 일이었는지 모릅니다. **출처(누구에게서 언제)까지** 함께 남깁니다.
「이관받은 것」 탭으로 모아 볼 수 있고, 회사 대표도 같은 기록을 봅니다.

## 5-9. 인플루언서 쪽

**창이 바뀌지 않습니다.** 담당자가 바뀐 사실만 대화에 시스템 줄로 남고 알림이 갑니다.

```
「담당자가 김서연님으로 바뀌었어요」
```

인플루언서에게는 광고주 한 곳당(정확히는 담당자당) 창 하나입니다. 담당자 교체로 창이 갈리면
지난 이야기를 못 찾습니다.

**⚠️ 이관해도 딜시트·대화의 발신자 이름은 바뀌지 않습니다.** 홍길동이 보낸 대화는 그대로 남습니다 —
무슨 일이 있었는지가 기록입니다.

## 5-10. 예정일이 지나면

대표 화면에 「남은 N건 대신 이관」이 뜹니다. 대표도 **건마다 받을 사람을 지정**할 수 있어야 합니다 —
일괄 지정만 되면 결국 한 사람에게 몰립니다.

---

# 6. 정산 완료 기록 — 팀원도 한다

```
src/components/SettleConfirmModal.tsx
```

**권한 제약을 두지 마세요.** 매치포스트가 송금하지 않습니다. 회사가 밖에서 송금한 뒤
그 자료로 기록만 하는 것이라, 그 캠페인을 진행한 사람이 하는 것이 자연스럽습니다.
대표를 거치면 정산이 대표 앞에 쌓여 병목이 됩니다.

- 자기가 연 캠페인은 **처음부터 정산 완료까지 본인이** 한다
- 대표는 **확인만** 한다 (회사 관리 모드에서 전사 정산). 승인 단계를 만들지 않는다
- 세무자료 요청도 팀원이 직접 한다

**대신 누가 기록했는지 남깁니다:**
```
모달 헤더에 「기록자 {이름}」 배지 (10px/700 · background:#F1F1F4 · color:#7C7C88)
확인 문구 「기록 시각과 기록한 사람({이름})이 남고 수정할 수 없어요 — 결제를 마친 뒤에 눌러주세요」
```

---

# 7. 방향 — PC 와 앱 (설계 기준)

새 기능을 만들 때 이 표로 판단하세요.

| 무엇 | 어디서 |
| --- | --- |
| **광고주가 일하는 곳은 PC** | 캠페인 등록 · 딜시트 · 정산 기록 · 팀 관리 · 업무 현황 |
| **앱은 현황 체크와 응대** | 알림 · 대시 답장 · 진행 현황 · 휴무 신청 · 미수 문의 |
| 앱에서 급할 때 되어야 하는 것 | 캠페인 열기 · 대시 보내기 |
| 앱에서 PC 로 보내는 것 | 딜시트 전체 표 · 팀 관리 · 업무 현황 · 크레딧 원장 · 정산 상세 |
| **인플루언서는 반대 — 앱이 주력** | 오픈 등록 · 채널 인증 · 대시 · 게재 링크 · **딜시트** |

- **앱에서 막는 기능은 없습니다.** 「PC 에서 하세요」로 끝내면 그 순간 다른 도구를 씁니다
- 안내 문구는 **「상세 내용은 PC 버전에서 확인해주세요」**
- 「PC 에서 확인」은 **광고주 화면에만** 씁니다. 인플루언서를 PC 로 보내면 주력 경로를 막는 것입니다
- 인플루언서 딜시트는 **내 일정과 진행 단계** 중심. 화면 위에 다음 할 일 하나를 크게
  (「8/20까지 원고 제출」). 페이·미션·가이드는 펼쳐 보는 영역으로

---

# 8. 확인

```bash
# 1. 선행 컬럼
grep -rn "manager_id" sql/migrations/0083*                    # 있어야 함
grep -rn "campaigns.*manager_id" src/lib src/app              # 배선 확인

# 2. 모드 전환
grep -rn "companyMode\|isCompanyMode" src/components          # 있어야 함
grep -rn "viewShare" src/lib/team                             # 있어야 함

# 3. 업무 현황 — 팀원 경로가 없어야 함
grep -rn "team-workload\|workload" src/app/\(dashboard\)/advertiser/team

# 4. 휴무
ls sql/migrations/0084*                                        # 있어야 함
grep -rn "substitute_id" src                                   # 대행자 배선

# 5. 이관
ls sql/migrations/0085*                                        # 있어야 함
grep -rn "leave_on\|퇴사 예정" src/app/\(dashboard\)/advertiser/team

# 6. 정산 — 권한 체크가 없어야 함
grep -rn "role.*대표.*settle\|settle.*role" src                # 0 이어야 함
grep -rn "기록자" src/components/SettleConfirmModal.tsx        # 있어야 함
```

브라우저 (PC):
- [ ] 대표 계정 — 상단바에 「내 업무 / 회사 관리」, 팀원 없으면 안 보임
- [ ] 회사 관리로 바꾸면 사이드바에 팀·크레딧이 나타남
- [ ] 담당자 필터를 바꾸면 **KPI·부제·목록이 함께** 바뀜
- [ ] 「전체」가 팀원별 합과 정확히 일치
- [ ] 팀 → 업무 현황 탭 — 네 절, 지연율에 원자료 괄호
- [ ] 팀원 계정으로 로그인 — 회사 캠페인이 보이고 기본 필터가 내 담당
- [ ] 팀원 계정에 업무 현황 경로가 **없음**
- [ ] 휴무 신청 — 걸린 일이 보이고, 대표 수락 시 대행자 없으면 비활성
- [ ] 반려 → 메모 → 팀원 답 → 「다시 판단」
- [ ] 퇴사 예정 전환 → 퇴사자 본인이 메모와 함께 이관 → 받는 사람 배너
- [ ] 팀원이 정산 완료를 기록할 수 있고 「기록자」가 남음
