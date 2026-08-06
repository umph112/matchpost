# 매치포스트 — 2차 구현 지시 (settleCampaign 과 그 의존 테이블)

> 1차(크레딧 원장, 0018~0021)는 완료됐다. 이번엔 **정산 훅과 그것이 기대는 테이블 3개**를 만든다.
> `settleCampaign` 은 이 셋이 없으면 만들 수 없다: `deal_checkpoints` · `reviews` · `notifications`.
> **화면은 만들지 않는다.** 스키마 + 서버 액션까지.

레포: `umph112/matchpost` (Next.js App Router + Supabase)
이전 마이그레이션: 0018 credit_ledger / 0019 open_group_id / 0020 initiated_by / 0021 celebrate_dedup
→ 이번 파일은 **0022** 부터.

---

## 0. 먼저 확인할 것

`deals` 테이블이 실제로 있는지 확인한다. 없다면 **`proposals` 가 딜 역할을 하고 있는 것**이다
(양쪽 확정된 proposal = 딜). 그 경우 아래의 `deal_id` 는 전부 `proposal_id` 로 읽고,
`deals.settled_at` 은 `proposals.settled_at` 으로 만든다.

```sql
select to_regclass('public.deals') as deals;
```

⚠️ 새 테이블을 만들지 말고 **현재 구조에 맞춰라.** 딜을 별도 테이블로 분리하는 건 이번 범위가 아니다.
아래 문서는 `deals` 가 없다는 가정(= proposals 사용)으로 쓴다.

---

## 1. 정산 필드 (proposals)

```sql
alter table proposals
  add column if not exists settled_at               timestamptz,
  add column if not exists settled_backdated_reason text,
  add column if not exists payment_due_date         date,
  add column if not exists payment_due_date_original date,
  -- 원천징수 (세무 자료용 — 나중에 넣으면 과거 데이터가 없다)
  add column if not exists withholding_applied bool,
  add column if not exists amount_gross        int,
  add column if not exists amount_withheld     int,
  add column if not exists amount_net          int;
```

- `settled_at` 은 **「결제 등록」 버튼을 누른 시각**이다. 사용자가 날짜를 입력하지 않는다
- 소급 등록은 **7일 이내 + 사유 필수**. `settled_backdated_reason` 에 남긴다
- `payment_due_date_original` 은 최초 확정값. 신뢰 지표 판정은 이 값 기준

---

## 2. deal_checkpoints — 신뢰 지표의 원본

```sql
create table if not exists deal_checkpoints (
  id           uuid primary key default gen_random_uuid(),
  proposal_id  uuid not null references proposals(id) on delete cascade,
  kind         text not null check (kind in ('guide','draft','publish','payment')),
  responsible  text not null check (responsible in ('advertiser','influencer')),
  due_original date,
  due_adjusted date,
  completed_at timestamptz,
  late_days    int default 0,
  created_at   timestamptz not null default now(),
  unique (proposal_id, kind)
);
```

| kind | 책임 | 뜻 |
| --- | --- | --- |
| `guide` | advertiser | 가이드 전달 |
| `draft` | influencer | 원고 전달 |
| `publish` | influencer | 게재 |
| `payment` | advertiser | 결제 |

**지연 계산 — 유예 3일**
```
late_days = greatest(0, (completed_at::date - due_adjusted) - 3)
```

⚠️ **귀책 상계** — 앞 단계가 늦으면 뒷 단계 기준일을 자동으로 민다.
```
guide 가 N일 늦으면 → draft, publish 의 due_adjusted 를 N일 뒤로
draft 가 N일 늦으면 → publish 의 due_adjusted 를 N일 뒤로
```
`due_original` 은 그대로 두고 `due_adjusted` 만 민다. 판정은 `due_adjusted` 기준.
이 상계가 없으면 광고주 탓으로 밀린 일정이 인플루언서 점수를 깎는다.

체크포인트 행은 **양쪽 확정 시점에 4개를 한꺼번에 생성**한다(완료 전이면 `completed_at` 은 null).

---

## 3. reviews — 상호 평가

```sql
create table if not exists reviews (
  id           uuid primary key default gen_random_uuid(),
  proposal_id  uuid not null references proposals(id) on delete cascade,
  rater_id     uuid not null references auth.users(id),
  ratee_id     uuid not null references auth.users(id),
  role         text not null check (role in ('advertiser','influencer')),
  stars        int  check (stars between 1 and 5),
  tags         text[],
  private_note text,
  is_imputed   bool not null default false,
  submitted_at timestamptz,
  closed_at    timestamptz,
  created_at   timestamptz not null default now(),
  unique (proposal_id, rater_id)
);
```

⚠️ **개별 평가 행을 상대에게 반환하는 API 를 만들지 않는다.**
프런트에서 가리는 방식이면 개발자 도구로 그대로 보인다. RLS 로 막는다:

```sql
alter table reviews enable row level security;
-- 내가 쓴 평가만 조회 가능. 받은 평가는 집계 뷰로만 본다.
create policy "reviews_own_written" on reviews
  for select using (auth.uid() = rater_id);
```

- `is_imputed` = 7일 미응답 시 플랫폼 중앙값으로 채운 행.
  ⚠️ **초기 3개월은 채우지 말고 전부 `false` 로 둔다.** 분포를 보고 정책을 확정한다
- 태그 예시 — 인플루언서 평가: `일정을 잘 지켜요` `소통이 빨라요` `콘텐츠 퀄리티가 좋아요` `다시 함께하고 싶어요`
  / 광고주 평가: `결제가 정확해요` `가이드가 명확해요` `요구가 합리적이에요` `다시 함께하고 싶어요`

---

## 4. notifications — 상태 3단계

```sql
create table if not exists notifications (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users(id) on delete cascade,
  kind               text not null,
  ref_type           text,
  ref_id             uuid,
  title              text not null,
  body               text,
  state              text not null default 'unread'
                     check (state in ('unread','read','done')),
  notification_group text,
  read_at            timestamptz,
  done_at            timestamptz,
  created_at         timestamptz not null default now()
);

create table if not exists notification_schedules (
  id                 uuid primary key default gen_random_uuid(),
  notification_group text not null,
  user_id            uuid not null references auth.users(id) on delete cascade,
  kind               text not null,
  ref_type           text,
  ref_id             uuid,
  payload            jsonb,
  send_at            timestamptz not null,
  sent_at            timestamptz,
  cancelled_at       timestamptz
);
```

**「봤다」와 「처리했다」를 구분한다.**
| 상태 | 바뀌는 것 |
| --- | --- |
| `read` | **배지에서만 빠진다.** 예약된 리마인드는 그대로 나간다 |
| `done` | 목록에서 내려가고 **같은 group 의 남은 예약을 전부 취소** |

`done` 은 **행위로만** 된다 — 원고 등록 / 게재 링크 등록 / 방문 체크 / 입금 확인.
⚠️ 미수금 알림은 **결제 등록이 실제로 들어와야** `done`. 봤다고 내려가면 가장 놓치기 쉬워진다.

---

## 5. 연락처 차단 예약

연락처는 **양쪽 확정 이후에만** 공개되고, **결제 등록 완료 5일 뒤** 다시 가린다.

```sql
alter table proposals
  add column if not exists contact_hidden_at timestamptz;  -- settled_at + 5일

create table if not exists contact_reveal_log (
  id          uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references proposals(id) on delete cascade,
  viewer_id   uuid not null references auth.users(id),
  viewed_at   timestamptz not null default now()
);
```

`/api/deal/contact` 를 고친다:
```
양쪽 확정 && (contact_hidden_at is null || now() < contact_hidden_at)
→ 이 조건일 때만 phone 을 응답에 담는다
+ 조회할 때마다 contact_reveal_log 에 기록
```
⚠️ **결제가 등록되지 않은 협업은 번호가 계속 열려 있다.** 미정산 상태에서 연락이 막히면
인플루언서가 대금을 받을 방법이 사라진다. `contact_hidden_at` 은 정산 시점에만 채운다.

---

## 6. trust_score — 집계 뷰

```sql
create or replace view trust_score as
select
  u.user_id,
  u.role,
  count(c.*)                                        as checkpoints_total,
  count(c.*) filter (where c.late_days = 0)         as checkpoints_on_time,
  case when count(c.*) >= 3
       then round(count(c.*) filter (where c.late_days = 0)::numeric / count(c.*), 3)
       end                                          as on_time_rate,
  ...
from ...
```

정확한 조인은 실제 스키마에 맞춰 작성하되, **아래 규칙은 반드시 지킨다.**

| 규칙 | 값 |
| --- | --- |
| 집계 구간 | 최근 **12개월** 롤링 |
| 자동 지표 공개 | 협업 **3건 이상**부터. 미만이면 `null`(= `기록 쌓이는 중`) |
| 별점 공개 | 리뷰 **5건 이상**부터. `is_imputed` 행은 **건수에서 제외** |
| 태그 공개 | **3명 이상**이 고른 태그만 |
| 광고주 핵심 지표 | 정산 정확도 (`payment` 체크포인트) |
| 인플루언서 핵심 지표 | 일정 준수도 (`draft` + `publish` 체크포인트) |

---

## 7. settleCampaign — 정산 훅 ⭐

**하나의 함수. 여러 화면에서 호출한다.** 한 트랜잭션에서 6가지가 일어난다.

```ts
// src/lib/deals/settle.ts
export async function settleCampaign(proposalId: string, opts?: {
  backdatedReason?: string        // 소급 등록 시 사유 (7일 이내만)
  withholding?: { applied: boolean; gross: number; withheld: number; net: number }
})
```

1. **`proposals.settled_at = now()`** — 이미 값이 있으면 에러(중복 정산 방지)
2. **`deal_checkpoints` 의 `payment` 완료 처리** — `completed_at = now()`,
   `late_days = greatest(0, (now()::date - due_adjusted) - 3)`
3. **양쪽에 `deal_complete` 크레딧 +3,000** —
   `credit_ledger_grant(user_id, 3000, 'reward', 'deal_complete', 'proposal', proposal_id)`
   ⚠️ **celebrate 와 같은 방식으로 중복 차단**: 같은 `ref_id` + `reason_code='deal_complete'` 행이
   이미 있으면 지급하지 않는다
4. **`trust_score` 갱신** — 뷰라면 자동. 캐시 테이블이면 여기서 재계산
5. **상호 평가 요청** — 양쪽에 `notifications` 1행씩 + `notification_schedules` 에
   D+3(리마인드) · D+7(마감) 예약. `notification_group = 'review:' || proposal_id`
6. **연락처 차단 예약** — `proposals.contact_hidden_at = settled_at + interval '5 days'`

**실패 시 전부 롤백.** 크레딧만 지급되고 정산 기록이 없는 상태가 생기면 안 된다.

### 배치 (cron 인프라가 없으면 Supabase pg_cron 또는 Vercel Cron)
| 주기 | 작업 |
| --- | --- |
| 일 1회 | `notification_schedules` 중 `send_at <= now() and sent_at is null and cancelled_at is null` 발송 |
| 일 1회 | 휴면 차감 — `credit_ledger_decay` (14일 −500 / 30일마다 −1,000, 하한 5,000C, 3일 전 예고) |
| 일 1회 | 결제 예정일 알림 (D-3 / D-day / D+1 / D+7) |
| 주 1회 | `visit_weekly` +500 (주 5일 이상 방문) |
| 월 1회 | `visit_monthly` +2,000 (월 20일 이상 방문) |

방문 기록은 `user_visit_log(user_id, visited_on)` 에 **하루 1행**만. 원장에 매일 쌓지 않는다.

---

## 8. 이번 차수에서 하지 않을 것
- 화면·컴포넌트 구현 (다음 차수)
- 파랑(`text-blue-600` 등) 색 정리 — 화면 차수에서 한 번에
- 중앙값 채움 로직 (`is_imputed`) — 컬럼만 만들고 로직은 3개월 뒤
- 세무사 연계 · 제3자 제공 동의 화면
