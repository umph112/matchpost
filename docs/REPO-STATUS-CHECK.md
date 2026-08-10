# 레포 상태 점검 절차 (기기 이동 시)

> 사용자가 **"최신 레포 확인해줘"** 라고 하면 Claude는 이 문서 순서대로 전부 확인하고 결과를 표로 보고한다.
> 노트북↔데스크톱을 번갈아 쓰기 때문에, **git으로 동기화되는 건 코드뿐**이라는 전제에서 출발한다.
> 작성: 2026-08-10 (데스크톱 세션에서 실제로 문제가 발견되어 절차화)

## 왜 필요한가

git push/pull은 코드만 맞춰준다. 아래 4종은 git 밖에 있어서 기기·환경마다 어긋나고,
**어긋나도 에러가 안 나고 조용히 실패**하는 경우가 많아 눈치채기 어렵다.

| 항목 | git 동기화 | 어긋나면 생기는 일 |
|---|---|---|
| 코드 | ✅ 됨 | — |
| `.env.local` | ❌ (`.gitignore`에 `.env*`) | 기능이 키 없이 조용히 실패 |
| Supabase DB 스키마 | ❌ (클라우드 공유지만 "실행했는지"는 무기록) | 테이블 없는데 코드가 조회 → 빈 배열 반환 |
| Storage 버킷 / Vercel 환경변수 | ❌ (대시보드 수동 생성) | 업로드·배포판 기능 실패 |

---

## 1단계 — git 동기화 상태

```powershell
cd <matchpost 경로>
git fetch origin
git status -sb                    # 미커밋/미추적 파일, ahead/behind
git log --oneline -5
git log origin/main --oneline -5  # 원격 최신과 대조
```

**판정**
- `behind N` → `git pull --ff-only origin main`
- `ahead N` → 반대편 기기가 모르는 커밋. 푸시 필요
- 미추적(`??`) 파일 → **신규 작성 파일이 커밋에서 누락된 전례 있음.** 반드시 전수 확인
- 양쪽 다 있으면 → 이쪽에서 먼저 커밋·푸시 후 반대편이 pull (문서 파일은 충돌 잦음)

## 2단계 — 의존성·타입

```powershell
git diff <이전커밋> <현재커밋> -- package.json package-lock.json   # 변경 있으면 npm install
npx tsc --noEmit
```

## 3단계 — 환경변수

```powershell
npx vercel env pull .env.local
```

- 프로젝트 링크(`.vercel/project.json`)와 CLI 로그인이 돼 있으면 바로 실행된다
- **Vercel에 없고 로컬에만 있는 키는 CLI가 지우지 않고 `Kept`로 보존한다** (2026-08-10 실측)
- 출력의 `not found in the ... Environment` 줄 = Vercel에 미등록이라는 뜻. 배포판에서 그 기능이 안 된다는 신호
- 새 키는 **로컬이 아니라 Vercel에 먼저** 넣어야 원본이 유지된다 (`npx vercel env add KEY`)

확인만 할 때:
```powershell
Get-Content .env.local | Select-String '^\s*[A-Z_]+\s*=' | ForEach-Object { ($_ -split '=')[0].Trim() }
```
> 주의: `KEY = value`처럼 등호 앞뒤 공백이 있는 줄이 있다. `^[A-Z_]+=` 로만 찾으면 놓친다(실제로 놓쳤음).

## 4단계 — DB 실제 상태 대조 ⭐ 가장 중요

문서의 "실행 필요/완료" 표기를 **믿지 말고** DB에 직접 물어본다.
`.env.local`의 `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` 사용. 전부 읽기 전용.

```bash
URL=$(grep -E '^NEXT_PUBLIC_SUPABASE_URL' .env.local | head -1 | sed 's/^[^=]*=//' | tr -d '"\r ')
KEY=$(grep -E '^SUPABASE_SERVICE_ROLE_KEY' .env.local | head -1 | sed 's/^[^=]*=//' | tr -d '"\r ')

# (a) DB에 실제 존재하는 테이블·뷰 전체
curl -s -H "apikey: $KEY" -H "Authorization: Bearer $KEY" "$URL/rest/v1/" \
  | python -c "import sys,json;print('\n'.join(sorted(json.load(sys.stdin)['definitions'])))" \
  | LC_ALL=C sort -u > /tmp/db_s.txt

# (b) 마이그레이션 파일이 만드는 객체
grep -hoiE "create (table|or replace view|view|materialized view)( if not exists)? +[a-z_.]+" sql/migrations/*.sql \
  | sed -E 's/.* //' | sed 's/^public\.//' | LC_ALL=C sort -u > /tmp/mig_s.txt

# (c) 차집합 — 파일엔 있는데 DB에 없다 = 미실행 마이그레이션 의심
LC_ALL=C comm -13 /tmp/db_s.txt /tmp/mig_s.txt
```

개별 확인:
```bash
curl -s -o /dev/null -w "%{http_code}\n" -H "apikey: $KEY" -H "Authorization: Bearer $KEY" \
  "$URL/rest/v1/<테이블>?select=<컬럼>&limit=0"     # 200=있음, 404(PGRST205)=없음
```

**해석 주의**
- `comm -13` 결과에 **의도적으로 drop된 테이블**이 섞인다. 예: `credits`, `credit_transactions`는 `0018_credit_ledger.sql`이 일부러 삭제한 것 → 오히려 0018이 실행됐다는 증거
- `comm -23`(DB에만 있음) 쪽의 `profiles`·`campaigns`·`schedules`·`proposals`·`messages` 등은 번호 마이그레이션 이전의 초기 스키마다. 문제 아님
- 🚨 **함수·트리거만 만드는 마이그레이션은 이 방법으로 검증 불가**(0058·0059·0061·0064 등). 실제 호출해보면 정산·크레딧 데이터가 바뀌므로 **호출하지 말 것.** 같은 라운드의 테이블 생성 마이그레이션 존재 여부로 간접 판단한다

## 5단계 — Storage 버킷

```bash
curl -s -H "apikey: $KEY" -H "Authorization: Bearer $KEY" "$URL/storage/v1/bucket" | tr ',' '\n' | grep '"name"'
```
코드가 쓰는 버킷명과 대조한다. 대시보드에서 수동 생성하는 것이라 누락이 잦다.

---

## 알려진 미완료 항목 (2026-08-10 확인, 미해결)

해결하면 이 절을 지운다. **반대로 새로 발견하면 여기에 추가한다.**

1. **Storage `campaign-images` 버킷 없음** — 현재 `chat-files`, `campaign-guides` 둘뿐. migration 0011로 컬럼은 있으므로 캠페인 이미지 업로드가 버킷 단계에서 실패 가능
2. **Vercel에 `NAVER_API_CLIENT_ID` / `NAVER_API_CLIENT_SECRET` 미등록**(development 기준) — 배포판 장소검색·오픈 조인 영향. 로컬엔 둘 다 값 있음
3. **`CRON_SECRET` 등록 여부 미확인** — `vercel.json` 크론 7개가 이 키로 인증한다. 미등록이면 배포판 크론이 전부 401. 로컬 개발엔 불필요
4. **배치 라우트 11개 중 4개가 `vercel.json`에 미등록** — `cancellation-autoconfirm`, `cancellation-count-reset`, `report-autoclose`, `sanction-recalc`. 의도인지 누락인지 미확인

## CLAUDE.md 신뢰도 경고

`CLAUDE.md`의 "Supabase 미실행 SQL(순서대로) 0058~0064" 및 0010/0011/0018/0019 "실행 필요" 표기는
**실제로는 전부 실행 완료** 상태다(2026-08-10 DB 대조). SQL은 돌리고 문서 줄만 안 지운 것.

그러나 같은 문단의 `campaign-images` 버킷·Vercel 네이버키는 **진짜 미완료**다.
→ **"⚠️ 표시 일괄 정리"는 위험하다.** 반드시 DB와 1:1 대조 후 개별 판단할 것.

## 세션 마감 시 (다음 사람이 헤매지 않도록)

1. `git status` 전수 확인 → 미추적 신규 파일 `git add` 후 커밋·푸시
2. 이번 세션에 만든 SQL은 **실행했는지 여부까지** 날짜와 함께 기록 (`0065 실행 완료(08-11)`)
3. 완료된 "실행 필요" 표기는 그 자리에서 삭제. **안 한 건 반드시 남긴다**
4. 대시보드에서 손으로 만든 것(버킷·Vercel 변수)은 위 "알려진 미완료 항목"이나 CLAUDE.md에 기록
