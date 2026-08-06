# 매치포스트 — 1차 구현 지시 (스키마 · 서버 우선)

> **이번 범위는 스키마와 서버 액션까지다. 화면은 만들지 않는다.**
> 화면은 다음 차수에 별도 문서로 준다. 여기 있는 것들은 **데이터가 쌓인 뒤에는 고치기 어려운 것**들이라 먼저 세운다.
> 상세 화면 스펙은 `README.md`(별도), 정책 배경은 `MANUAL-SOURCE.md` 참조.

레포: `umph112/matchpost` (Next.js App Router + Supabase)

---

## 왜 이 순서인가
화면부터 만들고 나중에 스키마를 고치면 화면까지 같이 뜯게 된다.
스키마와 서버 액션이 먼저 서 있으면 그 위에 화면을 얹었다 바꾸는 건 싼 작업이다.
아래 6개는 **나중에 넣으면 과거 데이터가 없어 기능이 반쪽이 되는 것**들이다.

---

## 1. 크레딧 원장 (credit_ledger)

⚠️ `users.credit_balance` 같은 숫자 컬럼을 더하고 빼지 말 것. 분쟁 시 아무것도 증명하지 못한다.
거래를 **append-only** 로 쌓고 잔액은 합계로 파생시킨다.

```sql
credit_ledger (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id),
  delta        int  not null,           -- 지급 +, 차감 −
  wallet       text not null,           -- 'free' | 'paid'
  kind         text not null,           -- 'welcome'|'reward'|'charge'|'refund'|'purchase'|'penalty'|'decay'|'admin'
  reason_code  text not null,           -- 아래 표. 유저 화면 문구가 여기서 파생된다
  ref_type     text,                    -- 'schedule'|'campaign'|'proposal'|'deal'|'review'|'invite'|null
  ref_id       uuid,
  memo         text,                    -- 관리자 내부 메모. 유저에게 노출 안 함
  admin_id     uuid,                    -- kind='admin' 일 때만
  expires_at   timestamptz,             -- ⚠️ 현재 정책상 항상 null. 컬럼만 미리 만든다
  created_at   timestamptz not null default now()
);
```

**꼭 지킬 것**
- **`wallet` 을 지금 넣는다.** 충전 기능이 아직 없어도 넣는다. 유상 크레딧에는 환불 의무·부가세·
  소멸시효가 걸리고 무상에는 안 걸린다. 한 통에 저장하면 나중에 절대 분리할 수 없다
- **`expires_at` 도 지금 넣는다.** 값은 항상 `null`. 나중에 신규 지급분에만 유효기간을
  붙이고 싶어질 때 마이그레이션이 필요 없어진다
- 모든 행은 **불변**이다. 취소·환불은 기존 행 수정이 아니라 **반대 부호의 새 행**
- 잔액 = `sum(delta) where user_id = ?` (뷰 또는 트리거 캐시)
- 차감은 **잔액 확인 → insert 를 한 트랜잭션**에서. 동시 요청으로 음수가 되면 안 된다
- 소진 순서: `free` 를 먼저 쓰고 부족분만 `paid`

**차감 (1C = 1원)**
| reason_code | 대상 | 금액 |
| --- | --- | --- |
| `open_schedule` | 인플루언서 | 1,000 — **날짜 수와 무관하게 오픈 1건당** |
| `create_campaign` | 광고주 | 5,000 |
| `send_proposal` | 광고주 | 500 — 대화 시작 시 1회. 메시지 수 무관 |
| `unlock_profile` | 광고주 | 1,000 — 1회 결제 후 영구. **연락처는 포함하지 않는다** |

검색 · 프로필 열람 · 메시지 읽기는 **영구 무료**.

**지급**
| reason_code | 대상 | 금액 | 조건 |
| --- | --- | --- | --- |
| `welcome` | 양쪽 | 30,000 | 첫 로그인 1회 |
| `profile_complete` | 양쪽 | 3,000 | 계정당 1회 |
| `first_action` | 양쪽 | 3,000 | 첫 오픈/첫 캠페인. 계정당 1회 |
| `encourage` | 양쪽 | 500 | 오픈·캠페인을 열 때마다 |
| `celebrate` | 양쪽 | 2,000 | 그것이 협업으로 성사되면 |
| `deal_complete` | **양쪽 모두** | 3,000 | 정산 완료 시점 |
| `review` | 양쪽 | 1,000 | 종료 후 7일 이내 작성 |
| `invite` | 초대자 | 5,000 | 피초대자가 첫 활동을 마쳐야 |
| `visit_weekly` | 양쪽 | 500 | 한 주 5일 이상 방문 |
| `visit_monthly` | 양쪽 | 2,000 | 한 달 20일 이상 방문 |
| `comeback` | 양쪽 | 1,000 | 30일 공백 후 복귀 1회 |

**환불 · 페널티**
| 상황 | 처리 |
| --- | --- |
| 오픈·캠페인 취소 — **양쪽 확정 전** | 전액 환불 (`kind='refund'`) |
| 오픈·캠페인 취소 — **양쪽 확정 후** | 환불 없음 + 같은 금액 추가 차감 (`kind='penalty'`) |
| 상대가 취소 | 내 차감분 전액 환불. 페널티는 취소한 쪽에만 |

**휴면 차감 (`kind='decay'`)** — 배치 일 1회
| 미방문 | 차감 |
| --- | --- |
| 7일 | 없음 — 알림만 |
| 14일 | −500 (1회) `dormant_14` |
| 30일 이후 | −1,000, **30일마다 반복** `dormant_30` |

- **무상 지갑만** 차감. `paid` 는 어떤 경우에도 건드리지 않는다 (법적 위험)
- **하한 5,000C.** 잔액이 5,000 이하면 차감하지 않는다
- **차감 3일 전 예고 알림 필수**

```sql
user_visit_log (user_id, visited_on date, primary key (user_id, visited_on));
-- 일일 방문은 원장에 쌓지 않는다. 하루 1행만 남기고 주간·월간 배치가 집계해 원장에 1행씩 지급.
-- users.last_visited_at 도 함께 갱신.
```
"방문" = 로그인 상태로 앱/웹을 연 것. 알림 클릭·이메일 열람은 방문이 아니다.

---

## 2. 결제 조건 — 날짜가 아니라 규칙으로 받는다

실무에서는 협의 시점에 결제일이 특정되지 않는다. `원고 게재 기준 익월 O일` 같은 **조건**으로만 합의한다.
그래서 광고주가 예정일을 비워둔 채 두었다가 돈을 보낸 뒤 결제 처리만 눌러버린다.
→ 예정일이 없으니 지연 판정이 불가능해진다.

```sql
alter table campaigns add column
  payment_term_type  text not null,   -- 'after_publish_next_month' | 'after_publish_days' | 'fixed_date'
  payment_term_value int,             -- 익월 O일 / O일 이내
  payment_due_date   date;            -- fixed_date 이거나 게재 완료로 확정된 뒤에만 값이 있다
```

- **조건은 필수, 날짜는 선택.** 등록 폼에서 조건을 비워둘 수 없게 막는다
- 기본값은 `after_publish_next_month` (가장 흔한 형태)
- **게재 완료 시점에 규칙 → 실제 날짜로 자동 확정**. 광고주가 따로 입력할 일이 없다

**결제일은 입력받지 않는다**
```sql
alter table deals add column
  settled_at                timestamptz,   -- 「결제 등록」 버튼을 누른 시각. 수정 불가
  settled_backdated_reason  text;          -- 소급 입력 시 사유. 7일 이내만 허용
```

**예정일 변경 — 허용하되 흔적을 남긴다**
```sql
payment_due_changes (
  id, deal_id, from_date date, to_date date, reason text,
  changed_at timestamptz, changed_by uuid,
  acked_by_influencer bool default false,   -- 알림의 '확인' 버튼
  acked_at timestamptz
);
alter table deals add column payment_due_date_original date;
```

⚠️ **문제 삼는 것은 「변경」이 아니라 「말없이 미루는 것」이다.**
변경 자체를 벌하면 광고주는 변경을 숨기고, 인플루언서는 더 늦게 알게 된다.

| 유형 | 성실도 판정 | 변경 횟수 집계 |
| --- | --- | --- |
| 예정일 **전** 변경 + 인플루언서 `확인` | 새 날짜 기준 (위반 아님) | **제외** |
| 예정일 전 변경 + 미확인/무응답 | 새 날짜 기준 | 집계 |
| 예정일이 **지난 뒤** 변경 | **최초 확정값 기준 — 지연** | 집계 (가중치 2배) |

- 변경 시 해당 인플루언서 전원에게 즉시 알림 + `확인`/`협의 필요` 버튼
- 지표 이름은 `unagreed_change_rate` (미협의 변경률)

---

## 3. 딜 체크포인트 — 신뢰 지표의 원본

⚠️ 나중에 넣으면 과거 데이터가 없어 지표가 반쪽이 된다. 지금 넣는다.

```sql
deal_checkpoints (
  id, deal_id,
  kind         text,   -- 'guide' | 'draft' | 'publish' | 'payment'
  responsible  text,   -- 'advertiser' | 'influencer'
  due_original date,
  due_adjusted date,   -- 귀책 상계 반영
  completed_at timestamptz,
  late_days    int     -- max(0, completed - due_adjusted - 3일 유예)
);
```

| kind | 책임 | 딜시트 단계 |
| --- | --- | --- |
| `guide` 가이드 전달 | 광고주 | 가이드 |
| `draft` 원고 전달 | 인플루언서 | 원고 |
| `publish` 게재 | 인플루언서 | 게재 |
| `payment` 결제 | 광고주 | 정산 |

⚠️ **귀책 상계 — 이게 빠지면 지표가 불공정해진다**
```
가이드가 3일 늦게 왔다 → draft_due, publish_due 를 자동으로 3일 뒤로 민다
수정 요청이 늦었다     → publish_due 를 그만큼 민다
광고주 사정으로 방문일이 밀렸다 → 이후 모든 due 를 민다
```
밀린 기준일(`due_adjusted`)로 판정하고 원래 값(`due_original`)도 함께 보관한다.
상계는 딜시트 타임스탬프에서 **자동 도출**한다 — 수동 이의제기 절차를 만들지 않는다.
**유예 3일** — 4일 이상부터 지연으로 센다.

```sql
-- 뷰 또는 캐시. settleCampaign 훅에서 갱신
trust_score (
  user_id, role, window_months,          -- 12개월 롤링
  checkpoints_total, checkpoints_on_time, on_time_rate,
  deals_count, avg_stars, review_count,
  stars_visible bool,      -- review_count >= 5 (실제 응답만 셈)
  top_tags text[],         -- 3명 이상이 고른 태그만
  response_rate numeric,
  unagreed_change_rate numeric,
  updated_at
);
```
- 자동 지표는 **3건 이상**, 별점은 **5건 이상**부터 공개
- 인플루언서의 체크포인트는 건당 2개(`draft`, `publish`)

---

## 4. 상호 평가

```sql
reviews (
  id, deal_id, rater_id, ratee_id, role,
  stars int, tags text[], private_note text,
  is_imputed bool default false,   -- 7일 미응답 → 중앙값 채움 (⚠️ 초기 3개월은 전부 false)
  submitted_at, closed_at
);
```

⚠️ **개별 평가 행을 상대에게 반환하는 API 를 만들지 않는다.**
프런트에서 가리는 방식이면 결국 샌다. ratee 용 엔드포인트는 **집계 뷰만** 반환한다.

| 구분 | 공개 대상 |
| --- | --- |
| 내가 받은 **개별** 평가 | **아무에게도 공개하지 않음** (본인 포함) |
| 비공개 코멘트 | 운영팀만 |
| 집계 결과 | 조건 충족 시 전체 공개 |
| 내가 **쓴** 평가 | 본인만, 수정 불가 |

- 요청 시점: 결제 등록 완료(`settled_at`) 직후 → D+3 리마인드 1회 → D+7 마감
- 7일 이내 작성 시 +1,000C
- 미응답 중앙값 채움은 **플랫폼 전체 중앙값**(개인 중앙값 아님), `review_count` 에는 넣지 않음,
  **별점만** 채우고 태그·코멘트는 채우지 않음, 자동 지표는 **절대 채우지 않음**
- **초기 3개월은 채우지 말고 원자료만 모은다.** 분포를 보고 정책을 확정한다

---

## 5. 연락처 공개

⚠️ **서버에서 막는다.** 확정 전에는 응답 JSON에 전화번호를 **아예 담지 않는다.**
프런트에서 가리기만 하면 개발자 도구로 그대로 보인다.

```
대시 상세 API 가 me_confirmed && other_confirmed 를 검사한 뒤에만 phone 필드를 붙인다
```

- **양쪽 확정 이후에만** 공개. 크레딧으로 앞당길 수 없다 (`unlock_profile` 은 상세 프로필까지)
- **결제 등록 완료(`deals.settled_at`) 5일 뒤** 다시 가린다
- ⚠️ **결제가 등록되지 않은 협업은 번호가 계속 열려 있다.** 미정산 상태에서 연락이 막히면
  인플루언서가 대금을 받을 방법이 사라진다
- 공개·조회 기록: `contact_reveal_log(deal_id, viewer_id, viewed_at)`

---

## 6. 알림 상태 3단계

```sql
notifications (
  id, user_id, kind, ref_type, ref_id,
  state text,              -- 'unread' | 'read' | 'done'
  notification_group text, -- 같은 건의 알림들을 묶는다
  read_at, done_at, created_at
);
notification_schedules (   -- 예약 발송. state='done' 이면 그룹의 남은 행을 취소
  id, notification_group, user_id, ref_type, ref_id,
  send_at, sent_at, cancelled_at
);
```

**「봤다」와 「처리했다」를 구분한다.**
| 상태 | 바뀌는 것 |
| --- | --- |
| `read` | **배지에서만 빠진다.** 예약된 리마인드는 그대로 나간다 |
| `done` | 목록에서 내려가고 **남은 리마인드도 취소** |

`done` 은 **행위로만** 된다 — 원고 등록 / 게재 링크 등록 / 방문 체크 / 입금 확인.
⚠️ **미수금은 결제 등록이 실제로 들어와야 `done` 이다.** 봤다고 내려가면 가장 놓치기 쉬워진다.

---

## 7. 세무 연계 준비 (필드만)

나중에 붙이려면 과거 데이터가 없어 반쪽이 된다. **결제 등록 시점에 받는다.**

```sql
alter table deals add column
  withholding_applied bool,     -- 3.3% 원천징수 여부
  amount_gross        int,      -- 세전
  amount_withheld     int,      -- 원천징수액
  amount_net          int;      -- 실지급
-- 광고주 사업자등록번호는 가입 시 이미 수집 중 → 조인으로 사용
```
연간 집계하면 **지급명세서 대조**가 된다. 세무사가 가장 반기는 자료다.

**제3자 제공 동의** — 약관에 뭉뚱그리면 나중에 못 쓴다.
```sql
tax_consents (user_id, accountant_id, fields text[], purpose, retention, agreed_at, revoked_at);
tax_export_log (user_id, accountant_id, period, fields, exported_at);
```
인플루언서 개별·명시적 동의 + 광고주 사업자 정보 제공 동의(가입 시 별도 항목).

---

## 8. 서버 액션 · 훅

### `settleCampaign(campaignId)` — 하나의 함수. 여러 화면에서 호출
정산 완료 시 이 함수가 바꾸는 것:
1. `deals.settled_at` = now (수정 불가)
2. `deal_checkpoints` 의 `payment` 완료 처리 + `late_days` 계산
3. 양쪽에 `deal_complete` 크레딧 +3,000 지급
4. `trust_score` 갱신 (`on_time_rate`, `unagreed_change_rate`)
5. 상호 평가 요청 알림 발송 + D+3 / D+7 예약
6. 연락처 자동 차단 예약 (settled_at + 5일)

### 배치
| 주기 | 작업 |
| --- | --- |
| 일 1회 | 휴면 차감 (`dormant_14`, `dormant_30`) + 3일 전 예고 알림 |
| 일 1회 | 결제 예정일 알림 (D-3 / D-day / D+1 / D+7) |
| 주 1회 | `visit_weekly` 집계 지급 |
| 월 1회 | `visit_monthly` 집계 지급 |
| 일 1회 | `trust_score` 재계산 (12개월 롤링) |

---

## 9. 기존 레포에서 고칠 것 (이번 차수)

1. **`search/page.tsx` 의 독자 `CATEGORIES`(10개) 제거** → `src/lib/categories.ts` 의
   `INFLUENCER_CATEGORIES` **23개 전체 import**. 화면별 복사본 금지 — 서로 달라지면 매칭이 샌다
2. **아바타 이니셜** — `otherName?.[0]`(앞 글자) → **별명 마지막 어절의 첫 글자**
   ```js
   const initialOf = (name) => (name.trim().split(/\s+/).pop() ?? name)[0];
   // '뷰티하는 지연' → '지',  '성수 델리카페' → '델'
   ```
3. **채팅 버블 `bg-blue-600` 제거** → 내 메시지 `#17171B`, 상대 `#F1F1F4`.
   파랑은 **공개 오픈 일정 전용 색**이라 채팅에 쓰면 의미가 섞인다
4. **`scrollIntoView` 제거** → 해당 컨테이너의 `scrollTop = scrollHeight`
5. **용어 통일** — 「메시지」→「대시」(라우트는 `/messages` 유지), 「수익」→「매출」

---

## 10. 이번 차수에서 **하지 않을 것**
- 화면·컴포넌트 구현 (다음 차수)
- 크레딧 충전·결제 연동 (유상 지갑은 컬럼만)
- 비용·영수증 관리 기능 (범위 밖. 세무사에게 직접 넘길 자료다)
- 계정 정지·캠페인 개설 차단 (제재는 정보 공개와 상품 제한까지)
