# D25 — 채널 등록 후 첫 리포트 안내

수집은 **정해진 시각의 배치**로만 돈다. 등록 즉시 돌리지 않는다.
대신 **언제 볼 수 있는지**를 등록한 그 자리에서 알려준다.

---

# 0. 지금 상태

| 것 | 어디 | 지금 |
| --- | --- | --- |
| 블로그 URL 저장 | `influencer_profiles.blog_url` | 됨 |
| 수집 함수 | `lib/blogAnalyzer/run.ts` · `runBlogAnalyzerBatch({ userId? })` | 있음 |
| **부르는 곳** | — | **없음** |
| 화면 | `blog_analytics` 를 읽기만 | 행이 없어 「—」 |

URL 을 넣어도 아무 일도 일어나지 않고, 인플루언서는 이유를 모른다.

---

# 1. 수집 시각 — 매일 밤 10시 (KST)

화면 문구에 이미 「매일 밤 10시 자동 수집」이 적혀 있다. 그 시각을 원본으로 삼는다.

```
sql/…  또는  vercel.json
{ "crons": [{ "path": "/api/blog-analyzer/run", "schedule": "0 13 * * *" }] }
```

⚠️ Vercel Cron 은 **UTC** 다. KST 22:00 = **UTC 13:00**.

## 1-1. 배치 라우트

```
src/app/api/blog-analyzer/run/route.ts   (신규)
```

- `CRON_SECRET` 헤더 검사 후 `runBlogAnalyzerBatch()` 호출
- 아무나 부를 수 있으면 네이버 레이트리밋에 걸린다

⚠️ `NAVER_API_CLIENT_ID` · `NAVER_API_CLIENT_SECRET` 이 Vercel 에 없으면
배치가 돌아도 전부 실패로 기록된다. 크론을 켜기 전에 넣어야 한다.

---

# 2. 「언제부터 볼 수 있나」를 계산해서 보여준다

## 2-1. 규칙

```
등록 시각이 그날 22:00 **이전**  →  오늘 밤 10시
등록 시각이 그날 22:00 **이후**  →  내일 밤 10시
```

같은 「내일」이 아니다. 저녁 9시에 등록한 사람은 한 시간 뒤에 보고,
밤 11시에 등록한 사람은 하루를 기다린다. 그 차이를 그대로 말해준다.

```ts
// src/lib/blogAnalyzer/schedule.ts (신규)
export function nextCollectAt(now = new Date()): Date
export function firstReportLabel(now = new Date()): string
//   → 「오늘 밤 10시」 / 「내일(8월 23일) 밤 10시」
```

⚠️ KST 기준으로 계산한다. `lib/date.ts` 의 `kstDateString()` 과 같은 방식을 쓴다.

## 2-2. 등록 직후 화면

블로그 URL 을 저장하면 그 자리에 카드로:

```
background:#FFFBEB · border:1px solid #FDE68A · radius:11px · padding:14px 16px
「채널을 등록했어요」            13px/700 · #92400E
「{첫 리포트 시점}에 첫 리포트가 만들어져요.
 방문자 · 이웃 수 · 발행 주기를 모아 등급을 계산합니다.」
                               11.5px · #B45309 · line-height:1.65
```

## 2-3. 리포트가 아직 없을 때 (채널 분석 화면)

지금은 「—」만 있다. **왜 없는지와 언제 오는지**를 넣는다.

```
아이콘 lucide BarChart3 32px · #C4C4CE
「첫 리포트를 준비하고 있어요」   14px/700 · #3C3C46
「{첫 리포트 시점}에 만들어집니다. 매일 밤 10시에 갱신돼요.」
                                 11.5px · #9A9AA5
```

`blog_url` 이 **비어 있으면** 다른 문구다 — 「채널을 등록하면 분석이 시작돼요」 + 등록 버튼.
둘을 구분해야 한다. 등록했는데 「등록하세요」가 뜨면 등록이 안 된 줄 안다.

---

# 3. 첫 리포트는 반쪽이다 — 그것도 말해준다

수집이 한 번 돈 시점에 없는 값이 있다.

| 지표 | 첫날 | 왜 |
| --- | --- | --- |
| 전일 대비 방문자 | **없음** | 비교할 어제 값이 없다 (`run.ts` 의 `visitorDaily` 가 `null`) |
| 포스팅 키워드 노출 | 그날 발행한 글만 | 배치가 `batchDate` 에 발행된 글만 검사한다 |
| 등급 | 나올 수 있음 | `missing_metrics` 에 빠진 항목이 기록된다 |

그래서 첫 리포트 화면에:

```
「방문자 증감은 내일부터 보여요 — 어제와 비교해야 하는 값이에요.」
11px · #9A9AA5
```

`missing_metrics` 가 비어 있지 않으면 그 개수를 함께:
「아직 모이지 않은 지표 {N}개가 있어 등급이 바뀔 수 있어요.」

⚠️ 등급을 감추지 마라. 「아직 판단할 근거가 부족하다」를 옆에 적는 것으로 충분하다.

---

# 4. 확인

```bash
ls src/app/api/blog-analyzer/run/route.ts      # 있어야 함
grep -n "crons" vercel.json                     # 0 13 * * * (KST 22:00)
grep -rn "nextCollectAt\|firstReportLabel" src  # 등록 직후 · 빈 상태 두 곳
grep -rn "runBlogAnalyzerBatch" src/app/api     # 크론에서만 호출
```

- [ ] 블로그 URL 저장 → 「오늘 밤 10시에 첫 리포트」 카드
- [ ] 밤 10시 이후에 등록 → 「내일(날짜) 밤 10시」
- [ ] 채널 분석 화면 — URL 있음/없음 문구가 다름
- [ ] 첫 리포트에 「방문자 증감은 내일부터」
- [ ] Vercel 환경변수 넣기 전에는 크론을 켜지 않음
