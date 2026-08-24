# D27 — 배치 4개 통로 + 취소 임계값 역할별 분기

대상: `umph112/matchpost@763abcf66929` (2026-08-24 확인)

---

# 0. 무엇이 문제인가

## 0-1. 회복 배치 4개가 크론에 없다

`vercel.json` 을 읽었습니다. 크론 **9개**가 등록돼 있고, 배치 라우트는 **13개**입니다.
빠진 4개가 전부 **회복 경로**입니다.

| 배치 | 하는 일 | 안 돌면 |
| --- | --- | --- |
`cancellation-count-reset` | 60일 무취소면 카운트 0 | **60일 리셋 규칙이 무력화** — 취소 기록이 영구히 남는다 |
`cancellation-autoconfirm` | 취소 요청 기한 후 자동 확정 | 상대가 응답 없으면 그 건이 영원히 대기 |
`report-autoclose` | 오래된 신고 자동 종결 | 처리 대기 큐에 계속 쌓인다 |
`sanction-recalc` | 제재 단계 재계산 | **지연이 개선돼도 단계가 안 내려간다** |

⚠️ **벌은 즉시 적용되고 회복은 배치가 돌아야 합니다.** 지금은 한쪽만 작동합니다.
관리자 「오늘」 화면의 시스템 현황에 이 4건이 붉게 뜨는 것이 그 신호입니다.

## 0-2. 취소 임계값이 역할을 구분하지 않는다

`src/` 전체를 검색했습니다 — 임계값 상수가 **없습니다**(`CANCEL_THRESHOLD` 0건).
`run_cancellation_count_reset_batch` RPC 안에만 기간이 들어 있고, 단계 판정은 어디에도 없습니다.

즉 **단계 규칙이 아직 구현되지 않았습니다.** 지금 만들면서 역할별로 갈라야 합니다.

---

# 1. 크론 4줄 추가

```json
{ "path": "/api/admin/batch/report-autoclose",           "schedule": "35 13 * * *" },
{ "path": "/api/admin/batch/sanction-recalc",            "schedule": "40 13 * * *" },
{ "path": "/api/admin/batch/cancellation-autoconfirm",   "schedule": "45 13 * * *" },
{ "path": "/api/admin/batch/cancellation-count-reset",   "schedule": "50 13 * * *" }
```

- 기존 배치가 `13:xx UTC`(= KST 22:xx)에 5분 간격으로 서 있으니 그 뒤를 잇습니다
- `35 · 40 · 45 · 50` — `purge-attachments`(30) 다음입니다
- 순서가 중요합니다: **`sanction-recalc` 가 `count-reset` 보다 먼저** 돌면
  리셋되기 전 카운트로 제재를 계산합니다. 위 순서(재계산 → 리셋)가 맞습니다

⚠️ 넷 다 `requireCronOrAdmin` 로 보호돼 있어 `CRON_SECRET` 없이는 401 입니다.
그 값은 이미 Vercel 에 등록돼 있습니다.

---

# 2. 취소 임계값 — 역할별

## 2-1. 단계표

| 누적 | 인플루언서 | 광고주 |
| --- | --- | --- |
| 1–2회 | 기록만 | 기록만 |
| **3회** | 기록만 | **본인 안내** |
| **4회** | 기록만 | **공개 표시** |
| **5회** | **본인 안내** | 〃 |
| **10회 이상** | **공개 표시** | 〃 |

리셋: 양쪽 **60일 무취소**.

**왜 갈랐나** — 취소로 잃는 것이 다릅니다. 인플루언서가 취소하면 광고주는 다른 사람을
찾으면 되지만, 광고주가 취소하면 인플루언서는 **그 날짜를 비워둔 채 기회를 잃습니다.**
광고주 취소는 참여자 전원에게 동시에 번지기도 합니다.

## 2-2. 단일 원본

```ts
// src/lib/cancellation/thresholds.ts (신규 — src/lib 검색 0건)

export type Role = 'influencer' | 'advertiser'

// ⚠️ 이 파일이 유일한 원본이다. 화면에서 숫자를 다시 쓰지 않는다.
const T = {
  influencer: { notify: 5, public: 10 },
  advertiser: { notify: 3, public: 4 },
} as const

export const RESET_DAYS = 60

export type CancelStage = 'none' | 'notify' | 'public'

export function cancelStage(role: Role, count: number): CancelStage {
  const t = T[role]
  if (count >= t.public) return 'public'
  if (count >= t.notify) return 'notify'
  return 'none'
}

// 본인 화면 안내 문구
export function cancelNotice(role: Role, count: number): string | null {
  const s = cancelStage(role, count)
  if (s === 'none') return null
  const t = T[role]
  if (s === 'notify')
    return `최근 취소 요청이 ${count}회예요. ${t.public}회가 되면 프로필에 표시됩니다.`
  return `취소 요청이 ${count}회라 프로필에 표시되고 있어요. 60일 동안 취소가 없으면 사라집니다.`
}
```

⚠️ **함수가 `role` 을 인자로 받아야 합니다.** 한 임계값으로 두면 둘 중 하나가 반드시 틀립니다.

## 2-3. 어디에 쓰나

| 자리 | 무엇 |
| --- | --- |
| **본인 화면** (설정 또는 홈) | `cancelNotice()` — `notify` 부터. 노란 카드(`#FFFBEB` / `#FDE68A`) |
| **공개 프로필** (`/advertiser/[id]`, 인플루언서 프로필) | `public` 이면 「취소 요청 잦음」 배지 (`#FEE2E2` / `#DC2626` · 10px/700 · radius:4px) |
| **검색 결과** | 같은 배지. 상대가 **수락 전에** 본다 |
| **관리자 회원 목록** | 역할 무관하게 카운트와 단계를 그대로 |

⚠️ 공개 표시는 **상대가 수락하기 전에 보여야** 의미가 있습니다. 확정 후에 보이면 늦습니다.

⚠️ 회복 경로를 문구에 반드시 넣으세요 — 「60일 동안 취소가 없으면 사라집니다」.
낙인만 있고 벗을 길이 없으면 그 계정을 버리게 됩니다.

## 2-4. 카운트를 올리는 지점

취소 **요청**이 아니라 **성립**에서 올립니다.

- 상대가 취소를 수락한 시점
- `cancellation-autoconfirm` 이 자동 확정한 시점

요청만 하고 철회한 것은 세지 않습니다.

⚠️ 카운트 컬럼이 어디에 있는지 확인하세요 — `run_cancellation_count_reset_batch` 가
읽는 그 컬럼이 원본입니다. 새로 만들지 마세요.

---

# 3. 확인

```bash
# 크론 13개
grep -c '"path"' vercel.json                                  # 13

# 임계값 단일 원본
ls src/lib/cancellation/thresholds.ts                          # 있어야 함
grep -rn "cancelStage\|cancelNotice" src/app src/components    # 사용처
grep -rn "=== 3\|>= 4\|>= 5\|>= 10" src/app | grep -i cancel   # 0 (화면에서 숫자 재작성 금지)

# 카운트 컬럼이 하나인지
grep -rn "cancellation_count\|cancel_count" src sql

npx next build
```

브라우저:
- [ ] 관리자 「오늘」 시스템 현황 — 붉은 4건이 사라짐
- [ ] 인플루언서 5회 → 본인 안내만 · 프로필엔 표시 없음
- [ ] 인플루언서 10회 → 프로필·검색에 배지
- [ ] 광고주 3회 → 본인 안내 · 4회 → 배지
- [ ] 안내 문구에 「60일 동안 취소가 없으면 사라집니다」
- [ ] 검색 결과에서 수락 전에 배지가 보임
