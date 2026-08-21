# D22 — 검색 노출 · 초대 자동 친구등록

대상: `umph112/matchpost@50a938f32939`

두 건입니다. 서로 무관하니 순서는 상관없습니다.

---

# A. 네이버·구글 검색 노출

## A-0. 기준 — 「검색엔진이 보는 것 = 비회원이 보는 것」

두 화면을 따로 만들지 마세요. **같은 페이지가 로그인 여부로 갈리게** 합니다.
따로 만들면 어느 쪽이 참인지 갈리고, 한쪽만 고치는 일이 생깁니다.

## A-1. 지금 없는 것

`src` 전체 검색 결과 — `robots` **0건**, `sitemap` **0건**.
`metadata` 는 `layout.tsx` · `terms` · `privacy` 세 곳뿐입니다.

즉 **캠페인·오픈 상세 페이지에 제목도 설명도 없습니다.** 색인되어도 검색 결과에
「매치포스트」만 나옵니다.

## A-2. 캠페인 — 공개

회사가 내는 공고입니다. 광고주 프로필(`/advertiser/[id]`)을 이미 공개 URL 로 만들었으니
같은 방식입니다.

```
/campaigns/[id]     (공개 · 신규)
```

비회원에게 보이는 것:
```
브랜드명 · 캠페인 제목 · 구분(지역/제품/기자단) · 채널 · 모집 인원
기간 · 지역 · 미션 요약 · 대표 이미지
「참여하려면 로그인해주세요」 CTA
```

보이지 않는 것 — **참여자 명단 · 페이 금액 · 딜시트 · 대화.**
페이는 협의 사항이고 공개되면 다음 협상의 기준선이 됩니다.

## A-3. 오픈 — 개인 일정이라 다르게

```
/opens/[id]         (공개 · 신규)
```

비회원에게 보이는 것: **날짜 · 지역 · 분야 · 채널 종류 · 페이대(구간)**
보이지 않는 것: **이름 · 채널 URL · 팔로워 수 · 연락처 · 정확한 페이**

「이 사람이 8월 20일에 시간이 비어 있다」는 개인 신변 정보에 가깝습니다.
날짜와 조건으로 찾아오게 하고, 누구인지는 로그인 후에 봅니다.

⚠️ **오픈 등록에 「검색에 노출」 토글을 먼저 넣으세요** (기본 **꺼짐**).
토글 없이 노출을 시작하면 이미 색인된 오픈을 나중에 빼기 어렵습니다.

```sql
-- sql/migrations/0089_schedules_seo.sql
alter table schedules add column if not exists seo_public boolean not null default false;
comment on column schedules.seo_public is
  '검색엔진 노출 동의. 기본 꺼짐 — 개인 일정이라 본인이 켠 것만 색인한다.';
```

오픈 등록 모달에 체크박스:
```
「검색에 노출하기」  기본 꺼짐
「네이버·구글에서 이 날짜를 찾을 수 있어요. 이름과 채널은 로그인한 사람에게만 보입니다.」
11.5px · #7C7C88
```

## A-4. 메타데이터

```
src/app/campaigns/[id]/page.tsx        generateMetadata
src/app/opens/[id]/page.tsx            generateMetadata
```

| 항목 | 캠페인 | 오픈 |
| --- | --- | --- |
| `title` | `{브랜드} {구분} 캠페인 · 매치포스트` | `{지역} {분야} 오픈 {날짜} · 매치포스트` |
| `description` | 미션 요약 첫 문장 + 기간 + 지역 | 날짜 · 지역 · 분야 · 페이대 |
| `openGraph.images` | 대표 이미지 | 없음 (개인 정보라 이미지 안 씀) |
| `alternates.canonical` | 그 URL | 그 URL |
| `robots` | `index` | `seo_public` 이면 `index`, 아니면 `noindex` |

⚠️ **URL 을 나중에 바꾸지 마세요.** 색인된 뒤 경로를 바꾸면 처음부터 다시입니다.
지금 `/campaigns/[id]` · `/opens/[id]` 로 확정하세요.

## A-5. `robots.txt` · `sitemap.xml`

```
src/app/robots.ts
src/app/sitemap.ts
```

```
robots.ts
  allow:    /  /campaigns/*  /opens/*  /advertiser/*  /terms  /privacy
  disallow: /advertiser/dashboard  /influencer/*  /admin/*  /api/*  /signup  /login
            (로그인 뒤 화면은 전부)

sitemap.ts
  · 진행 중인 캠페인 (모집중 · 진행중)
  · seo_public = true 이고 날짜가 지나지 않은 오픈
  · 광고주 프로필 (사업자 확인된 것만)
  · 정적 페이지 (/ · /terms · /privacy)
```

⚠️ **지난 캠페인·오픈은 sitemap 에서 빼세요.** 이미 끝난 건이 검색에 남으면
찾아온 사람이 「없는 건」을 봅니다. 페이지는 남기되(링크가 깨지면 더 나쁨)
「이 캠페인은 종료됐어요」 + 진행 중인 캠페인 목록으로 안내하세요.

## A-6. 신청 시점

**캠페인·오픈이 쌓인 뒤**에 네이버 서치어드바이저에 신청하세요.
빈 사이트로 색인되면 그 인상이 한동안 남습니다.

신청 전 확인:
- [ ] `/campaigns/[id]` · `/opens/[id]` 가 로그아웃 상태에서 열림
- [ ] 오픈에 이름·채널·팔로워가 **안 보임**
- [ ] `seo_public` 꺼진 오픈은 `noindex`
- [ ] `robots.txt` 가 로그인 뒤 화면을 다 막음
- [ ] `sitemap.xml` 에 진행 중인 것만 있음
- [ ] 카톡 공유 미리보기에 제목·설명이 제대로 나옴

---

# B. 초대 링크 자동 친구등록

## B-1. 조건이 해소됐습니다

D13 §3 에서 `source='invite'` 를 「토큰 체계가 없어 제외」했습니다.
그런데 지금 있습니다:

```
team_members.invite_token
/signup?invite={token}
src/app/api/signup/invite/route.ts
src/app/api/team/accept/route.ts
src/app/api/team/invite-info/route.ts
```

## B-2. ⚠️ 그런데 이것은 팀원 초대입니다

`invite_token` 은 **광고주가 자기 회사 팀원을 초대**하는 토큰입니다.
D13 의 `source='invite'` 는 **광고주가 인플루언서를 캠페인에 초대**하는 것이었습니다.
**다른 기능입니다.**

`connections.source` 의 `'invite'` 는 후자를 위한 값입니다. 팀원 초대로 친구등록이
생기면 안 됩니다 — 같은 회사 사람인데 「친구등록된 인플루언서」가 됩니다.

## B-3. 그래서 먼저 확인하세요

```bash
# 캠페인 초대 링크가 있나
grep -rn "campaign.*invite\|invite.*campaign" src/app/api src/lib
grep -rn "join.*token\|campaign_invite" src sql
```

| 확인 결과 | 그러면 |
| --- | --- |
| **캠페인 초대 링크가 있다** | 그 참여 성공 지점에 `register_connection(..., 'invite', false)` 를 붙이세요 (알림 없음 — 참여가 곧 의사 표시) |
| **없다** | **이번 회차에 만들지 마세요.** 공개 URL 체계·토큰 만료·중복 참여 처리가 함께 필요합니다. 별도 건으로 보고해 주세요 |

⚠️ 팀원 초대 경로(`api/signup/invite` · `api/team/accept`)에 친구등록을 붙이지 마세요.
그것은 회사 내부 구성원 추가입니다.

## B-4. 캠페인 초대가 없으면 — 대신 할 것

D13 §3 의 `'invite'` 값은 `source` 체크 제약에 남겨두고, 목록 필터에서는 계속 빼세요
(값이 안 생기니 빈 필터가 됩니다). 지금 「전체 · 협업 · 직접」 3개가 맞습니다.

---

# C. 확인

```bash
# A
ls src/app/robots.ts src/app/sitemap.ts                  # 있어야 함
ls src/app/campaigns/\[id\]/page.tsx src/app/opens/\[id\]/page.tsx
grep -n "seo_public" sql/migrations/0089*
grep -rn "generateMetadata" src/app/campaigns src/app/opens

# 오픈에 개인정보가 안 나가야 함
grep -n "followers\|channel_url\|phone" src/app/opens/\[id\]/page.tsx   # 0 이어야 함

# B
grep -rn "'invite'" src/lib/connections                  # 붙였으면 있고, 안 붙였으면 0
```
