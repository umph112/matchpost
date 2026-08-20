# D20 — 결제일 변경 합의 경로

D19 §1-3-2 에서 조사만 하고 미룬 건입니다. **지금 가장 급합니다** —
합의했는데 매출 시점이 안 바뀌고 지연 알림이 매일 갑니다.

---

# 0. 지금 무엇이 잘못되어 있나

| 시나리오 | 지금 |
| --- | --- |
| 광고주가 대화에서 「결제를 9/5로 미루자」 | 텍스트로만 남음. 시스템은 여전히 8/20 |
| 인플루언서가 수긍 | 합의는 됐는데 값이 안 바뀜 |
| 8/21 이 되면 | **미수로 뜨고, 광고주에게 지연 알림이 매일 발송** |
| 그 횟수가 | **제재 판정 근거로 쌓임** |
| 매출 화면 | 8월 매출에 잡혀 있고 9월로 옮겨지지 않음 |

합의를 지킨 광고주가 제재 근거를 쌓게 됩니다. 이것이 가장 나쁩니다.

# 1. 왜 안 되나 — 조사 결과 (D19 §1-3-2)

| 것 | 하는 일 |
| --- | --- |
| `proposals.proposed_date` | 제안 중인 날짜. **한 칸뿐이고 종류 구분이 없음** |
| `proposals.start_at` | 확정된 **진행일** |
| `accept_date_proposal(p_proposal_id, p_by_id)` (0066) | `proposed_date` → `start_at` 로 확정 |
| `campaigns.settlement_date` | **이 루틴과 무관.** 캠페인 값이고 협의로 안 바뀜 |

문제 셋:
- 결제일을 제안할 방법이 없다 (`proposed_date` 에 넣으면 `start_at`(진행일)이 덮인다)
- `proposals` 에 결제일 칸이 없다 (사람별 합의를 담을 곳이 없음)
- 날짜 카드가 종류를 말하지 않는다 (같은 모양이 두 뜻으로 쓰임)

---

# 2. 스키마

```sql
-- sql/migrations/0088_settlement_date_proposal.sql
alter table proposals add column if not exists settlement_date date;
comment on column proposals.settlement_date is
  '이 사람과 합의한 결제 예정일. 비면 campaigns.settlement_date 를 쓴다. 매출 시점의 원본.';

alter table proposals add column if not exists proposed_date_kind text
  check (proposed_date_kind in ('progress','settlement'));
comment on column proposals.proposed_date_kind is
  '제안 중인 날짜의 종류. progress = 진행일, settlement = 결제일. null 은 기존 데이터(진행일).';
```

**기존 행은 건드리지 마세요.** `proposed_date_kind` 가 `null` 이면 진행일로 읽습니다 —
지금까지 쓰인 방식이 그것입니다.

## 2-1. 읽는 규칙 — 한 곳에서

```
src/lib/deals/settlementDate.ts (신규)
```

```ts
// 매출 시점 · 미수 판정 · 지연 알림이 전부 이 함수를 지난다.
// 사람별 합의가 캠페인 기본값을 덮는다 (D9 「기본 일정 + 사람별 변경」과 같은 구조)
export function settlementDateOf(p: { settlement_date?: string | null },
                                 c: { settlement_date?: string | null }): string | null {
  return p.settlement_date ?? c.settlement_date ?? null
}
```

⚠️ **`campaigns.settlement_date` 를 직접 읽는 곳을 전부 이 함수로 바꾸세요.**
한 곳이라도 남으면 그 화면만 옛 날짜를 보여줍니다.

```bash
grep -rn "settlement_date" src | grep -v settlementDate.ts
```

바꿀 곳 (확인해서 더 있으면 함께):
- `influencer/earnings/page.tsx` — 매출 시점 · 미수 판정
- `influencer/dashboard/page.tsx` — 이번 달 매출 · 미수
- `components/SettlementsView.tsx` — 광고주 정산
- `api/admin/batch/*` — **지연 알림** (여기가 가장 중요)
- `admin` 정산 모니터

---

# 3. 결제일 제안 · 수락

## 3-1. 제안 — 어디서 하나

**대시 대화창**입니다. 새 화면을 만들지 마세요.

| 누가 | 어디에 |
| --- | --- |
| 광고주 | 대화방 입력창 위 「결제일 변경 제안」 |
| 인플루언서 | 같은 자리 (양쪽 다 제안할 수 있음) |

```
모달 폭 432px · z-index 60 · 오버레이 rgba(23,23,27,0.42) · padding 40px
헤더 B형 — h2 「결제일을 언제로 할까요?」 17px/800

현재 「지금 8월 20일이에요」 11.5px · #7C7C88
날짜 <input type="date"> height:46px · radius:11px
사유 한 줄 (선택) height:44px · placeholder 「예: 월말 정산 주기에 맞춰서」

안내 background:#FBFBFC · border:1px solid #EFEFF2 · radius:10px · padding:12px 13px
  「상대가 수락하면 그 날짜가 매출 시점이 됩니다. 합의된 변경은 지연으로 세지 않아요.」
  11.5px · #5C5C68 · line-height:1.65

푸터: 취소 / 「제안 보내기」 (검정 #17171B)
  날짜가 비면 비활성 (background:#EAEAEE · color:#B0B0BB)
```

저장: `proposed_date = 고른 날짜`, `proposed_date_kind = 'settlement'`

## 3-2. 카드 — 종류를 말한다

```
src/components/messages/MessageBubble.tsx
```

지금 날짜 제안 카드가 `proposed_date` 만 보고 그려집니다. **종류 라벨을 붙이세요.**

| 종류 | 라벨 | 부제 |
| --- | --- | --- |
| `progress` · `null` | **진행일 제안** | 「오픈해두신 날짜예요」 / 「…다른 날이에요」 (지금 그대로) |
| `settlement` | **결제일 제안** | 「지금은 8월 20일이에요」 |

라벨 `10px/800 · #B45309` (지금 「날짜 제안」이 있는 자리).
카드 색·크기는 그대로 — 모양이 같아도 라벨이 다르면 구분됩니다.

⚠️ **결제일 제안 카드에 「오픈해두신 날짜」 부제를 붙이지 마세요.** 오픈과 무관합니다.

## 3-3. 수락

```
sql/migrations/0088 에 함께
```

`accept_date_proposal` 을 종류에 따라 갈라야 합니다. **기존 함수를 고치지 말고
새 함수를 만들거나, 안에서 분기하세요** — 진행일 수락이 깨지면 안 됩니다.

```
kind = 'settlement' 이면
  proposals.settlement_date = proposed_date
  proposed_date = null · proposed_date_kind = null
  ⚠️ start_at 을 건드리지 않는다
  ⚠️ 겹침 검사(time_overlap) 안 한다 — 진행일만 겹치면 안 된다
  지연 알림 카운터 리셋 (overdue_reminder_count = 0)
  대화에 시스템 줄 「결제일을 9월 5일로 합의했어요」
  상대에게 알림
kind = 'progress' 또는 null 이면
  지금 동작 그대로
```

**⚠️ 지연 알림 카운터 리셋이 중요합니다.** 합의된 변경은 지연이 아닙니다.
리셋하지 않으면 이미 쌓인 횟수가 제재 근거로 남습니다.

## 3-4. 자기 제안은 자기가 수락 못 함

기존 `accept_date_proposal` 의 규칙(0066)을 그대로 씁니다. 결제일도 같습니다.

---

# 4. 광고주 화면에 「(변경)」 표시

```
src/components/DealSheet.tsx
src/components/SettlementsView.tsx
```

D9 §3 에 이미 정해져 있습니다 — 사람별로 달라진 값은 **「(변경)」 + 파란색(`#1D4ED8`)**.

`proposals.settlement_date` 가 있으면:
```
9/05 · D-16 (변경)
```

기본과 다르다는 사실이 보여야 왜 다른지 물어볼 수 있습니다.

---

# 5. 미수 카드 문구 — 합의 후

미수 카드의 안내가 지금은 「대시에서 인플루언서와 예정일을 다시 정해주세요」입니다.
그 경로가 생겼으니 **버튼으로 바꾸세요**:

```
「결제일 변경 제안」  ← 3-1 모달을 그 자리에서 열기
```

광고주 정산 화면의 미수 카드입니다. 지금은 대화로 가라고만 하고 갈 길이 없습니다.

---

# 6. 확인

```bash
# 스키마
grep -n "settlement_date\|proposed_date_kind" sql/migrations/0088*

# 단일 원본
grep -rn "settlement_date" src | grep -v settlementDate.ts | grep -v "0088"
# → 전부 settlementDateOf() 를 쓰고 있어야 함. 직접 읽는 곳이 남으면 안 됨

# 카드 종류
grep -n "proposed_date_kind\|결제일 제안" src/components/messages/MessageBubble.tsx

# 카운터 리셋
grep -n "overdue_reminder_count" sql/migrations/0088*
```

브라우저:
- [ ] 광고주 대화방에 「결제일 변경 제안」 → 모달 → 카드가 「결제일 제안」으로 뜸
- [ ] 인플루언서가 수락 → 시스템 줄 「결제일을 9월 5일로 합의했어요」
- [ ] 그 건의 매출 시점이 9월로 옮겨짐 (인플루언서 매출 화면)
- [ ] 미수에서 빠짐, **지연 알림 횟수가 0으로 리셋**
- [ ] 딜시트·정산에 「(변경)」 파란 표시
- [ ] 진행일 제안이 여전히 정상 동작 (`start_at` · 겹침 검사)
- [ ] 결제일 제안 카드에 「오픈해두신 날짜」 부제가 **없음**
- [ ] 광고주 미수 카드에 「결제일 변경 제안」 버튼
