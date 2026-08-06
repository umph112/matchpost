# 4차 구현 지시 — 서버 먼저 (관리자 화면 제외)

> 지금 넘기는 것은 **서버 스키마와 규칙**만입니다.
> 관리자 화면은 아직 설계 중이라 이 지시서에 없습니다.
> 사용자 화면(광고주/인플루언서)의 UI 는 3차 지시서(`IMPLEMENT-3-SCREENS.md`)를 그대로 따릅니다.
>
> 순서대로 하세요. 뒤 항목이 앞 항목의 컬럼에 기댑니다.
> 스펙과 다르게 가야 할 이유가 있으면 **멈추고 물어보세요.**

---

## ① 신고 (reports)

가장 먼저. 이후 제재·취소가 여기에 기댑니다.

```sql
create table reports (
  id            uuid primary key default gen_random_uuid(),
  reporter_id   uuid not null references profiles(id),
  counterpart_id uuid not null references profiles(id),
  source_type   text not null,          -- 'campaign' | 'proposal'
  source_id     uuid not null,
  type          text not null,          -- 아래 8종
  body          text not null,
  stage         text,                   -- 접수 시점 딜시트 단계
  snapshot      jsonb,                  -- 조건(일정·페이) · 마감일 · 정산 기록
  status        text not null default 'open',   -- open | resolved | closed | escalated
  closed_by     uuid,                   -- 신고자 또는 운영자
  close_reason  text,
  closed_at     timestamptz,
  created_at    timestamptz not null default now()
);
```

**type 8종** (UI 선택지 그대로)

| 신고자 | type | 자동 처리 |
| --- | --- | --- |
| 인플루언서 | `unpaid` 대금 미지급 | 광고주 지연 카운트 +1 |
| 인플루언서 | `cancel_unilateral` 일방적 취소·조건 변경 | 취소 카운트 +1 |
| 인플루언서 | `guide_mismatch_req` 가이드와 다른 요구 | 없음 |
| 광고주 | `draft_late` 원고 미제출·게재 지연 | 인플루언서 일정 준수도 반영 |
| 광고주 | `guide_violation` 가이드 불이행 | 없음 |
| 광고주 | `no_show` 무단 불참 | 인플루언서 완수율 반영 |
| 양쪽 | `abuse` 욕설·부적절한 요구 | 운영 검토 |
| 양쪽 | `etc` 기타 | 없음 |

**규칙**
- `source_type`·`source_id`·`counterpart_id`·`stage`·`snapshot` 은 **서버가 채운다.** 사용자는 type 과 body 만 입력
- 접수 즉시 **양쪽에 알림.** 몰래 신고 구조 금지
- **피신고자는 닫을 수 없다** — RLS 로 막을 것. `closed_by` 는 `reporter_id` 또는 운영자만
- 종료 4갈래: `resolved`(신고자 자체 해결) / `closed`(운영 종결, 사유 필수) / 자동 종결(14일 무진전, 7일차 리마인드) / `escalated`(외부 이관)
- 닫은 뒤 **7일 안에는 다시 열 수 있다**
- **해결률 지표는 `resolved` 만 센다.** 자동 종결을 성과로 잡으면 방치가 이득이 된다

⚠️ UI 문구는 「분쟁 신청」이 아니라 **「운영팀에 알리기」**. 종료 버튼은 **「해결됐어요」**.
신고자 화면 세 곳에 종료 버튼: 접수 완료 화면 · 홈 「지금 할 일」 · 대시 대화 상단.

---

## ② 제재 (sanctions)

```sql
create table sanctions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles(id),
  level       int  not null,      -- 0~5
  reason      text not null,
  clause      text,               -- 약관 조항 번호
  set_by      uuid,               -- null = 시스템 자동
  released_at timestamptz,
  created_at  timestamptz not null default now()
);
```

**6단계**

| lv | 이름 | 효과 | 발동 |
| --- | --- | --- | --- |
| 0 | 정상 | — | — |
| 1 | 주의 | 본인에게만 안내 · 외부 노출 없음 | 지연 비율 20% |
| 2 | 표시 | **인플루언서가 수락 전에 지연 이력을 봄** | 30% 또는 미입금 신고 1건 |
| 3 | 제한 | **미결제 건수 공개**(금액 아님) · 상단 노출 광고 구매 불가 | 50% 또는 미해결 신고 2건 |
| 4 | 정지 | 신규 캠페인 개설 불가 · **진행 건은 유지** | 반복 · 악의 확인 |
| 5 | 퇴출 | 계정 해지 · 재가입 차단(사업자번호 기준) | 미결제 방치 · 사기 정황 |

- **지연 비율로 판정한다** — 건수가 아니라. 규모가 큰 광고주가 불리해지면 안 된다
- `지연 = 늦게라도 낸 건 + 아직 안 낸 건(미수)`. **미수는 정의상 이미 지연**이다
- **선입금 권장은 쓰지 않는다.** 선입금 사기·환불 분쟁을 새로 부른다
- **금액은 공개하지 않는다.** 거래 규모 노출이 되고, 큰 건 하나가 잔건 여럿보다 과하게 나빠 보인다
- **해제는 자동** — 「미수 정산 완료 + 이후 3건 연속 정시」면 한 단계 하락. 사람이 풀면 봐주기 시비가 생긴다
- 4·5단계는 **진행 건이 끝난 뒤 집행.** 먼저 끊으면 남은 인플루언서가 돈을 못 받는다
- 5단계는 집행 전 **14일 유예 + 이의 제기 기간**, 사유 서면 통지

---

## ③ 협업 취소 (cancellations)

```sql
create table cancellations (
  id         uuid primary key default gen_random_uuid(),
  deal_id    uuid not null references proposals(id),
  by_id      uuid not null references profiles(id),
  reason     text not null,      -- 개인 사정 | 일정 중복 | 조건 불일치 | 건강 문제 | 기타
  message    text,
  stage_at   text not null,      -- 요청 시점 딜시트 단계
  agreed     boolean,            -- null=대기, true=수락, false=거절
  agreed_at  timestamptz,
  created_at timestamptz not null default now()
);
```

**흐름 — 요청 → 대화 → 상대 수락**
- 「협업 취소 요청」은 **즉시 취소가 아니다.** 사유를 적어 보내고 상대가 「취소 요청 수락」을 눌러야 확정
- **거절 버튼은 없다.** 무응답 **3일 → 자동 취소 확정 + 요청자에게 카운트 부과**
- 수신 화면은 세 곳: 확정 바 자리(교체) · 대화 맨 아래 카드 · 홈 「지금 할 일」
- 버튼은 **「대화로 조율하기」가 주(검정)**, 「취소 요청 수락」은 보조(아웃라인). 앰버 금지

**카운트 규칙**
- **합의 취소는 무페널티** — 지표에 반영하지 않는다
- 다만 **요청 횟수는 센다.** 1–2회 기록만 / 3회 본인 안내 / 4회부터 공개 표시
- **90일 무취소 시 0으로 리셋** (1회씩 차감 아님)
- 일방 취소: 가이드 후 = 카운트 +2, 방문 후 = 부분 정산 협의 필수, 게재 후 = 취소 불가
- **크레딧은 회수하지 않는다.** 회수하면 취소를 숨기려 든다

---

## ④ 협업 날짜 변경

오픈은 「발견되기 위한 것」, 협업 날짜는 「합의의 결과」다. 대화 시작 뒤에는 오픈을 새로 열지 않는다.

- 광고주가 대시에서 「다른 날짜 제안」 → 인플루언서 「이 날짜로 변경」 한 번
- **`proposals.date` 만 바뀐다. 크레딧 안 든다** (협의 중 조정이지 새 오픈이 아님)
- **원래 오픈은 그대로 열어둔다.** 확인 모달에 「N월 N일 오픈도 닫을까요?」 체크박스, **기본 꺼짐**
- 새 날짜는 오픈에 추가하지 않는다 — `schedules.source = 'dash'` 로 캘린더에만 고정
- **수락 플래그는 양쪽 초기화.** 조건이 바뀌었으니 다시 수락해야 한다

### ⚠️ 하루 = 협업 1건이 아니다
```sql
alter table proposals add column start_at timestamptz;
alter table proposals add column duration_min int default 60;
```
- **막는 것은 시간대 겹침 하나뿐.** 날짜 단위로 막지 않는다
- `11:00 확정 → 11:00–12:00 점유 → 11:30 수락 불가 / 12:00 수락 가능`
- 시각이 없는 건(`협의중`)은 점유하지 않는다 — 시각이 정해지는 순간 검사
- 막을 때 문구는 거절이 아니라 조정 안내 — 「다른 시간으로 조정하면 수락할 수 있어요」

---

## ⑤ 상호 등록 (connections)

```sql
create table connections (
  id         uuid primary key default gen_random_uuid(),
  a_id       uuid not null references profiles(id),
  b_id       uuid not null references profiles(id),
  a_ok       boolean not null default false,
  b_ok       boolean not null default false,
  created_at timestamptz not null default now(),
  unique (a_id, b_id)
);
```

- **양쪽 ok 일 때만 성립.** 한쪽만 등록하면 목록에 나타나지 않는다
- 만드는 법 ① 협업 종료 시 「서로 등록할까요?」 ② 초대 링크 + 상대 수락
- 특권 — **대시 없이 메시지.** 이미 아는 사이다
- 언제든 한쪽이 해제. 해제하면 메시지 권한도 사라진다
- **일방 등록을 허용하면 안 된다** — 광고주가 목록에 담고 무료 메시지를 보내는 스팸이 된다

---

## ⑥ 대시 과금 — 베타 기간 무료

- **대시 발송 100C 를 제거**한다. 화면·크레딧 안내에서 「베타 기간 무료」로 표기
- 「무료」가 아니라 **「베타 기간 무료」**로 쓸 것 — 나중에 과금할 때 반발이 없다
- 상호 등록 사이는 언제나 무제한 무료. 답장도 언제나 무료
- 스팸이 보이기 시작하면 `dash_quota`(하루 상한 + 초과분 과금)를 켠다. **지금은 만들지 않는다**

---

## ⑦ 대시 파일 → 딜시트 체크포인트

```sql
alter table messages add column checkpoint_kind text;  -- 'guide' | null
```
- 채팅 파일이 전부 가이드는 아니다 — **보낼 때 「가이드로 등록」 체크**(기본 켜짐)
- 체크된 것만 `deal_checkpoints` 의 가이드 단계로 기록
- **딜시트가 유일한 기록처.** 대시에서 한 행동도 딜시트에 남고, 그 역도 같다

---

## ⑧ 담당자 연락처

```sql
alter table profiles   add column manager_phone text;  -- 가입 시 필수
alter table profiles   add column company_phone text;  -- 선택
alter table campaigns  add column manager_phone text;  -- 비면 계정 값 사용
alter table campaigns  add column company_phone text;
```
- 가입 시 **담당자 휴대폰 필수**, 회사 대표번호 선택
- 캠페인 등록 폼은 계정 값을 불러와 채우고, 「이 캠페인만 다르게」로 덮어쓸 수 있다
- 노출은 `campaigns.manager_phone ?? profiles.manager_phone`
- 인플루언서 미수금 카드는 **`tel:` 링크로 담당자 휴대폰**을 직접 노출.
  대표번호는 담당자에게 닿지 않는다 — 미수 상황에서 교환원을 거치면 그 자리에서 포기한다

---

## ⑨ 블로그 등급 — 산식 수정

3차 지시서 ⑪⑫⑭에 있는 내용. 아직 안 했다면 여기서 함께.

- 노출 점수를 **순위 → 예상 유입량**(월간 검색량 × 순위별 CTR)으로
- 검색량은 네이버 검색광고 API, `keyword_search_volume` 에 캐시 · **월 1회** 갱신
- 체급(대형/중형/롱테일형)은 **등급과 별개 라벨**. 우열이 아니라 용도다
- 등급 구간 **S + A~D 각 3단계 = 13종**
- 크롤링 **매일 22:00**, 그날 발행 글 최대 5개만 추적
- 자정 넘겨 끝나도 `crawled_on` 은 **배치 시작일로 고정**
- `blog_score_history` 에 `score_version` 필수 — 버전 없이 바꾸면 「왜 떨어졌는지」를 설명할 수 없다

---

## 공통 · 절대 어기지 말 것

- **파랑 `#3B82F6` 은 「공개 오픈 일정」 전용.** 상태 칩·버튼·채팅에 쓰지 않는다
- **모든 수치는 하나의 원본 배열/API 에서 파생.** 하드코딩 금지
- **매출 귀속 기준은 결제일**
- 아바타 이니셜 = **별명 마지막 어절의 첫 글자**
- UI 에서 「브랜드」라 하지 않는다 — 전부 **「광고주」**
- 캠페인·오픈·협업·대시는 **「건」**, 사람은 「명」
- 딜시트 2단계 이름은 **「수락」**(「확정」 아님)
- 프로토타입의 **시나리오 스텝 칩은 데모용** — 구현하지 않는다
