# 핸드오프 만드는 절차 (고정)

> 빠짐이 반복된 원인은 「기억으로 목록을 만들고, 나중에 발견되면 고친다」였습니다.
> 이 문서의 순서를 지키면 빠질 수 없습니다. **문서를 쓰기 전에 1~3단계를 먼저 끝냅니다.**

---

## 1단계 — 목록을 먼저 세운다 (기계로)

프로토타입에서 **개수를 뽑아 표로 고정**합니다. 이 표가 목차이자 검산표입니다.

| 무엇 | 뽑는 방법 |
| --- | --- |
| 페이지 | `grep '<sc-if value="{{ is'` → 페이지 단위 조건 |
| 팝업·모달 | `grep 'position:fixed;inset:0'` |
| 서랍 패널 | `grep 'position:fixed;top:0;right:0'` |
| 인라인 팝오버 | `grep 'position:absolute;top:'` (오버레이 없는 것) |
| 표 | `grep 'grid-template-columns'` |
| 탭·필터 | `grep 'Tabs:\|Tabs =\|Filters ='` |

각 개수를 문서 첫 절에 적습니다: **페이지 N · 팝업 N · 팝오버 N**.

## 2단계 — 규칙은 범위로 검색한다 (나열하지 않는다)

문자를 하나씩 적으면 반드시 빠집니다. 범위·구조로 훑습니다.

```bash
# 이모지 — 개별 문자 나열 금지
grep -rnP "[\x{1F000}-\x{1FAFF}\x{2190}-\x{2BFF}\x{2700}-\x{27BF}\x{FE0F}]"

# PC 폭
grep -rn "max-w-lg\|max-w-md\|max-w-xl\|max-w-2xl\|max-w-3xl"

# 날짜
grep -rn "toLocaleDateString\|toLocaleString"

# 이니셜
grep -rn "name\[0\]\|charAt(0)\|\[0\]\.toUpperCase"

# 용어
grep -rn "메시지\|수익\|제안서\|받은 제안"
```

**결과 전부를 파일 경로 + 라인으로 문서에 적습니다.** grep 명령을 지시서에 넘기지 않습니다 —
읽는 쪽은 「경로가 적힌 것」만 고칩니다.

## 2.5단계 — 「신설」 전에 있는지 먼저 검색한다

같은 것이 이미 있는데 새로 만들라고 하면 **원본이 둘**이 됩니다. 지금까지 가장 자주 낸 사고입니다.

| 신설하려는 것 | 먼저 검색할 곳 |
| --- | --- |
| 테이블 · 컬럼 | `sql/migrations/` **전체** |
| API 라우트 | `src/app/api/` |
| 헬퍼 · 액션 | `src/lib/` |
| 컴포넌트 | `src/components/` |

하나라도 나오면 **확장**입니다. 「신설」은 검색 결과가 0건일 때만 씁니다.

문서에 「(신규)」라고 적을 때는 **무엇을 검색해서 없었는지 함께 적습니다.**
그래야 확인을 건너뛴 것이 드러납니다.

> 실제 사고: `connections` 테이블이 있는데 `advertiser_connections` 신설을 지시.
> 원인 — `src/` 만 검색하고 `sql/migrations/` 를 읽지 않음.

## 3단계 — 크로스 체크 (문서 쓰기 전)

- 1단계 표의 개수와 문서에 담긴 항목 수가 **같은지 센다**

### 지난 델타 항목별 확인 (필수)

**grep 으로 잡히지 않는 항목이 있습니다.** 「카드형인지 행 목록인지」, 「3단인지 2단인지」,
「배지가 붙었는지」는 검색어가 없습니다. **지난 문서의 항목을 표로 옮겨 하나씩 파일을 열어 확인합니다.**

| 지난 항목 | 확인할 파일 | 판정 |
| --- | --- | --- |
| (지난 문서의 각 절을 한 줄씩) | (그 절이 지목한 파일) | 반영 / 다름 / 없음 |

- **grep 으로 확인 가능한 것** → 2단계에서 처리
- **눈으로 봐야 하는 것** → 이 표에 넣고 파일을 읽는다
- 「다름」·「없음」은 이번 문서의 교정 항목으로 올린다

D10 에서 이 표를 만들지 않아 D8-3 의 8개 항목을 확인하지 못했습니다.
그중 대화 목록이 카드형으로 남아 있었습니다.

## 4단계 — 값으로 적는다

「PC 2단으로」가 아니라 값으로:

```
grid-template-columns: minmax(0,1.55fr) minmax(0,1fr) · gap:14px · align-items:stretch
표: minmax(0,1fr) 92px 128px 104px 152px 124px 126px
모달: width 428px · 오버레이 rgba(17,17,21,0.5) · z-index 200
```

같이 적을 것:
- **어느 카드가 늘어나는가** (`flex:1` 위치) — 안 적으면 좌우 단차가 생깁니다
- **표 헤더와 행이 같은 컬럼 값을 쓴다**는 사실
- **비활성 조건** — 무엇이 비면 버튼이 눌리지 않는가
- **z-index 순서**

## 5단계 — 확인 방법을 문서에 넣는다

- 고친 뒤 돌릴 grep + **「남아야 하는 개수」**
- 라우트 체크리스트 (파일명 오타는 빌드가 잡지 않습니다)
- 프로토타입을 나란히 띄워 비교할 화면 목록

---

## 절대 하지 않을 것

| 하지 않을 것 | 왜 |
| --- | --- |
| 「프로토타입을 보고 만드세요」로 끝내기 | 열어보지 않으면 전달되지 않습니다 |
| grep 명령을 구현 지시로 넘기기 | 체크리스트로 읽혀 실행되지 않습니다 |
| 이모지·용어를 손으로 나열해 검색 | 떠올리지 못한 것이 빠집니다 |
| 페이지 수만 세기 | 팝업·서랍·팝오버가 빠집니다 |
| 규칙만 적고 치수를 생략 | 「2단인지 3단인지」가 전달되지 않습니다 |
| grep 만으로 지난 항목 확인 | 「카드형인지 행 목록인지」는 검색어가 없습니다. 파일을 열어야 합니다 |
| 사용자 캡처를 보고서야 대조 시작 | 제가 먼저 대조해야 합니다 |

---

## 발행 기록

| 문서 | 담긴 것 | 개수 |
| --- | --- | --- |
| `handoff_D6_delta/` | 대시·캠페인·정산·크레딧·관리자·법무 규칙 | 6절 |
| `handoff_D7_fix/D7-FIX-BUILD.md` | 빌드 1차 대조 | 결함 30여 |
| `handoff_D7_fix/D7-APPENDIX-LANDING-SIGNUP.md` | 랜딩·로그인·가입 명세 | 화면 4 |
| `handoff_D8_fix/D8-FIX-SWEEP.md` | 5개 규칙 전수 | 87건 |
| `handoff_D8_fix/D8-2-EMOJI-SWEEP.md` | 이모지 범위 검색 | 24건 |
| `handoff_D8_fix/D8-3-DASH-AND-TWO-PAGES.md` | 대시 8건 + 2화면 | 10건 |
| `handoff_D9_spec/D9-PC-LAYOUT-SPEC.md` | **PC 골격 전체** | 페이지 20 · 팝업 20 · 팝오버 1 |


---

## 다음 핸드오프 때 대조할 것 (미확인 항목)

VS Code 에 지시했지만 레포로 아직 확인하지 못한 것. 다음 회차에 **파일을 열어 대조**하고,
빠져 있으면 그 회차 지시서에 다시 넣는다.

### D14 — `reassign_conversation_manager` (0085 갱신본)

`conversations` 는 RLS 가 켜져 있고 SELECT 정책만 있어서, 클라이언트에서
`conversations.manager_id` 를 UPDATE 하면 **0행으로 조용히 실패**한다.
그래서 `SECURITY DEFINER` 함수가 필요하다. 확인할 것 셋:

| 확인 | 왜 |
| --- | --- |
| 함수 안에서 **회사 소속(`advertiser_id`) 검사** 후 다르면 예외 | `SECURITY DEFINER` 는 RLS 를 건너뛴다. 함수 자체가 관문이다 |
| **`manager_id` 만** 바꾼다 | 다른 컬럼을 함께 갱신할 수 있게 열어두면 그 함수가 우회로가 된다 |
| 재배정과 **같은 트랜잭션**에서 시스템 줄 — 「담당자가 {이름}님으로 바뀌었어요」 | 담당은 바뀌었는데 인플루언서가 모르는 상태가 생기면 안 된다 |

```bash
grep -n "reassign_conversation_manager" sql/migrations/0085*
grep -n "advertiser_id" sql/migrations/0085*        # 소속 검사가 있어야 함
grep -n "담당자가" sql/migrations/0085* src/lib      # 시스템 줄
```

### D14 — 팀원 정산 진입 경로 (PROMPT-3 ③)

`campaigns/[id]/page.tsx` · `settlements/page.tsx` 의 게이트가
`advertiser_id === user.id` 에서 **회사 소속 여부**로 바뀌었는지.
권한만 열고 진입 경로가 대표 전용이면 팀원은 여전히 정산을 못 한다.

```bash
grep -n "advertiser_id === user.id" src/app/\(dashboard\)/advertiser/campaigns/\[id\]/page.tsx src/app/\(dashboard\)/advertiser/settlements/page.tsx   # 0 이어야 함
```

### D14 — 4·5절 화면 (목업 전달 후)

`leave-request.dc.html` · `work-transfer.dc.html` 실측값대로 구현됐는지.
`docs/design/d14/` 에 `.dc.html` 과 `support.js` 가 함께 들어갔는지도 확인한다
(두 번 빠졌다 — 문서만 옮기고 목업을 빼놓았다).
