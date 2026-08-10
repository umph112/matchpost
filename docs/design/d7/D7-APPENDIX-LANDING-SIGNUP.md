# D7 부록 — 랜딩 · 로그인 · 가입 화면 명세

프로토타입을 열지 않고도 만들 수 있게 값을 그대로 옮겼습니다.
색 · 크기 · 문구는 **여기 적힌 값을 그대로 쓰세요.** (원본: `intro-pc.dc.html`, `signup-onboarding-mobile.dc.html`)

대상 파일:
```
src/app/page.tsx                    → 랜딩 + 로그인 (2단)
src/app/intro/page.tsx              → 삭제 또는 / 로 통합
src/app/(auth)/login/page.tsx       → 좁은 카드 → 랜딩 우측 패널과 같은 구성
src/app/(auth)/signup/page.tsx      → 단계형으로 재구성
```

---

# 1. 공통 토큰

| 이름 | 값 | 쓰는 곳 |
| --- | --- | --- |
| ink | `#17171B` | 본문 글자 · 검정 버튼 |
| ink-2 | `#3C3C46` | 라벨 |
| gray-1 | `#5C5C68` | 보조 글자 |
| gray-2 | `#7C7C88` | 설명문 |
| gray-3 | `#9A9AA5` | 흐린 설명 |
| gray-4 | `#B0B0BB` | 가장 흐린 것 |
| line | `#EAEAEE` | 테두리 |
| line-2 | `#F1F1F4` | 옅은 구분선 |
| bg | `#F6F6F7` | 페이지 배경 |
| amber | `#F59E0B` | 브랜드 · 주 액션 |
| amber-ink | `#B45309` | amber 위 글자 |
| amber-bg | `#FEF3C7` | amber 배경 |
| red | `#DC2626` | 필수 표시 · 미응답 |
| green | `#15803D` | 인증됨 · 완료 |

폰트: Pretendard. 제목은 `font-weight:800`, `letter-spacing:-0.035em ~ -0.045em`.

---

# 2. 로고 컴포넌트 (`src/components/Logo.tsx` 신규)

지금 7개 파일이 각자 「MatchPost」 텍스트를 씁니다. 하나로 만들어 전부 교체하세요.

```
[마크 SVG] MATCH (·) POST   [BETA]
```

**마크 SVG** (그대로 복사):

```html
<svg viewBox="0 0 64 64" width="24" height="24">
  <rect width="64" height="64" rx="16.6" fill="#17171B"/>
  <rect y="37.1" width="64" height="1.9" fill="#fff" opacity="0.2"/>
  <rect x="24.3" width="1.9" height="64" fill="#fff" opacity="0.2"/>
  <circle cx="25.3" cy="38.1" r="8.3" fill="#F59E0B"/>
</svg>
```

어두운 배경에서는 `rect` fill 을 `#fff`, 내부 선을 `#17171B` opacity `0.18` 로 바꿉니다.

**글자**
- 폰트 `Archivo`, `font-weight:900`, `letter-spacing:0.05em`
- 사이즈: 콘솔 사이드바 19px / 랜딩 헤더 20px
- `MATCH` 와 `POST` 사이의 점은 **문자가 아니라 원**입니다

**점 규격 (중요 — 지금 전부 문자 `·` 를 씁니다)**

| 글자 크기 | 원 지름 | 좌우 여백 |
| --- | --- | --- |
| 14px | 4px | 3px |
| 19px | 5px | 4px |
| 20px | 5.5px | 4px |
| 41px | 11px | 8px |

```html
<span style="width:5.5px;height:5.5px;border-radius:50%;background:#F59E0B;margin:0 4px;flex-shrink:0"></span>
```

부모는 `display:flex; align-items:center; gap:1px; line-height:1` — 그래야 점이 세로 중앙에 옵니다.

**BETA 배지** (랜딩만)
```
font-size:10.5px; font-weight:800; letter-spacing:0.04em;
background:rgba(255,255,255,0.13); color:rgba(255,255,255,0.72);
border-radius:5px; padding:4px 8px; margin-left:3px
```

---

# 3. 랜딩 (`/`) — 좌 검정 / 우 흰색 2단

```
[좌: 검정 #17171B, flex:1]          [우: 흰색, 폭 고정 460px]
 로고 + BETA                          역할 헤드라인
 (중앙) 헤드라인 + 부제                 역할 탭 2개
        3포인트                        소셜 로그인 3개
 (하단) 푸터 — 사업자 정보              구분선 「또는」
                                      이메일 로그인
                                      가입 링크
                                      약관 동의 문구
```

- 좌측 `padding: 40px 52px`, 우측 `padding: 44px 52px`
- 좌측 배경에 **장식용 달력 격자**가 깔립니다 (아래 3-4)
- 모바일(<1024px)에서는 위아래로 쌓고, 좌측은 헤드라인 + 3포인트만 남깁니다

## 3-1. 헤드라인

```
내가 필요할 때!
손쉽게~
```
`font-size:46px; font-weight:800; letter-spacing:-0.045em; line-height:1.28; color:#fff`

부제 (`margin-top:24px`, `font-size:16px`, `color:rgba(255,255,255,0.62)`, `line-height:1.85`):
```
광고주와 인플루언서가 직접 만나는 협업 플랫폼입니다.
날짜 · 지역 · 분야로 찾고, 대화 한 번으로 협업이 시작됩니다.
```

## 3-2. 3포인트 (`margin-top:44px`, 항목 간 `gap:15px`)

번호: `font-size:11.5px; font-weight:800; letter-spacing:0.04em; color:#F59E0B; width:22px; padding-top:3px`
제목: `font-size:15px; font-weight:700; letter-spacing:-0.02em; color:#fff`
설명: `font-size:13px; color:rgba(255,255,255,0.48); line-height:1.65; margin-top:5px`

| 번호 | 제목 | 설명 |
| --- | --- | --- |
| 01 | 날짜와 장소, 키워드로 손쉽게 찾는 협업건 | 광고주와 인플루언서가 서로 원하는대로 자동 매칭까지 가능해요! |
| 02 | 자동생성 딜시트로 손쉽게 협업관리 | 협업 조율부터 결제까지 자동생성 딜시트로 쉽고 꼼꼼하게 챙겨줘요! |
| 03 | 인플루언서 마케팅, 매치포스트에서 다 된다 | 인플루언서 마케팅에 최적화된 시스템을 경험해보세요! |

## 3-3. 우측 패널

**헤드라인 — 고른 역할에 따라 바뀝니다**

| 역할 | 제목 | 설명 |
| --- | --- | --- |
| 광고주 | 광고주 콘솔 | 브랜드 · 대행사 · 매장 누구나 씁니다. 캠페인을 열고 진행 단계와 정산을 관리해요. |
| 인플루언서 | 인플루언서 콘솔 | 폰에서 더 편하게 쓰실 수 있어요. PC에서는 채널 분석과 매출 관리를 권합니다. |

제목 `font-size:22px; font-weight:800; letter-spacing:-0.035em`
설명 `font-size:13.5px; color:#7C7C88; line-height:1.7; margin-top:9px`

**역할 탭** (`margin-top:26px`, `gap:7px`)

칩: `height:44px; padding:0 16px; border-radius:11px; border:1px solid; font-size:13.5px; font-weight:700`
- 선택: `border-color:#17171B; background:#17171B; color:#fff`
- 미선택: `border-color:#E2E2E8; background:#fff; color:#7C7C88`

칩 안 마크 22px — **광고주는 사각(`border-radius:6px`), 인플루언서는 원(50%)**
- 선택: `background:rgba(255,255,255,0.16); color:#fff`
- 미선택: `background:#F1F1F4; color:#9A9AA5`

**소셜 로그인** (`margin-top:22px`, `gap:9px`)

`height:50px; border-radius:12px; padding:0 16px; font-size:14px; font-weight:700`
아이콘은 왼쪽, 글자는 가운데(`flex:1; text-align:center; margin-left:-26px`)

| 버튼 | 배경 | 글자 |
| --- | --- | --- |
| 카카오로 계속하기 | `#FEE500` | `#191600` |
| 네이버로 계속하기 | `#03C75A` | `#fff` |
| Apple로 계속하기 | `#000` | `#fff` |

**구분선** (`margin:22px 0`) — 좌우 `height:1px; background:#EAEAEE`, 가운데 「또는」 `font-size:12px; color:#B0B0BB`

**이메일 로그인** — 이메일 · 비밀번호 입력 + 검정 버튼(`background:#17171B; height:50px; border-radius:12px`)

**약관 동의 문구** (`margin-top:18px`, `font-size:11px; color:#B0B0BB; line-height:1.7; text-align:center`)
```
계속하면 이용약관과 개인정보 처리방침에 동의하는 것으로 봅니다.
```
「이용약관」 `/terms`, 「개인정보 처리방침」 `/privacy` 로 링크 — 둘 다 `color:#7C7C88; text-decoration:underline`

## 3-4. 배경 달력 격자 (좌측 장식)

**장식입니다.** 특정 연·월이 아니라 「일정이 차 있다」는 인상만 줍니다.

- 7열 × 6행 = 42칸, 각 칸 `aspect-ratio:1; border-radius:14px`
- 숫자는 오른쪽 위 (`padding:11px 12px 0 0`, `font-size:14px; font-weight:700`)
- 중앙에서 멀어질수록 흐려집니다: `fade = max(1 - dist*0.85, 0.12)`,
  `dist = |col-3|/3*0.55 + |row-2.5|/3*0.45`
- 색 의미는 제품과 같습니다 — amber 내 오픈 · green 확정 · **blue 공개 오픈**

| 톤 | 칸 인덱스 | rgb | 글자 | 배경 α | 테두리 α | glow α |
| --- | --- | --- | --- | --- | --- | --- |
| amber | 3, 9, 14, 25, 31, 37 | `245,158,11` | `255,214,140` | 0.30 | 0.62 | 0.24 |
| green | 7, 20, 34 | `34,197,94` | `187,247,208` | 0.24 | 0.52 | 0.20 |
| blue | 11, 17, 28, 40 | `59,130,246` | `191,219,254` | 0.22 | 0.48 | 0.18 |
| soft | 1, 5, 22, 29, 33, 41 | 흰색 | — | 0.075 | 0.16 | — |
| 그 외 | 나머지 | — | — | 없음 | 0.08 | — |

```
background: rgba(rgb, bgα*fade + 0.08)
border:     1px solid rgba(rgb, bdα*fade)
box-shadow: 0 0 32px rgba(rgb, glowα*fade)
color:      rgba(글자, 0.95*fade)
```

구현이 부담되면 **생략하고 검정 배경만** 두세요. 지금 캘린더처럼 실제 데이터를 넣으면 안 됩니다 —
로그인 전에는 날짜를 눌러도 볼 수 없어서 막다른 길이 됩니다.

## 3-5. 푸터 (좌측 하단)

`padding-top:17px; border-top:1px solid rgba(255,255,255,0.09)`, 세로 `gap:13px`

1행: `CONTENTS PLACE` (`font-size:11px; font-weight:800; letter-spacing:0.1em; color:rgba(255,255,255,0.5)`)
 + `v0.9.2` + 오른쪽에 링크 4개 (이용약관 / **개인정보처리방침(굵게)** / 이용 안내 / 문의하기)

2행: 사업자 정보 9항목 — `font-size:11px`, 라벨 `rgba(255,255,255,0.24)`, 값 `rgba(255,255,255,0.44)`
 끝에 「사업자정보 확인」 밑줄 링크

3행: 면책 문구 `font-size:11px; color:rgba(255,255,255,0.32); line-height:1.75; max-width:760px`

> `components/Footer.tsx` 가 이미 이 내용을 갖고 있습니다. **흰 배경용**이니
> 검정 배경 변형을 하나 더 만들거나, 랜딩 좌측 하단은 별도 마크업으로 두세요.
> 어느 쪽이든 **값은 Footer.tsx 한 곳에서** 읽어야 합니다.

---

# 4. 가입 (`/signup`) — 단계형

지금은 역할을 고르면 12개 필드가 한 번에 펼쳐집니다. 단계로 나누세요.

## 4-1. 광고주 (PC 3단계)

**단계 머리** — 뒤로(`‹`) + 단계 이름 + 오른쪽에 `N / 3`
진행바: `height:4px; border-radius:2px; background:#F1F1F4`, 채움 `background:#F59E0B`, 너비 `단계/3*100%`

| 단계 | 이름 | 제목 | 설명 |
| --- | --- | --- | --- |
| 1 | 회사 정보 | 어디에서 오셨나요? | 브랜드 · 대행사 · 매장 누구나 광고주로 시작할 수 있어요. 사업자등록증은 첫 캠페인을 등록할 때 받습니다. |
| 2 | 팀 초대 | 함께 쓸 분이 있으신가요? | 캠페인과 크레딧은 회사 계정에 쌓입니다. 담당자가 바뀌어도 기록은 그대로 남아요. |
| 3 | 완료 | 준비됐어요! | 이제 캠페인을 등록하거나, 날짜로 인플루언서를 찾아 대시할 수 있어요. |

제목 `font-size:21px; font-weight:800; letter-spacing:-0.035em; margin-top:24px`
설명 `font-size:13px; color:#7C7C88; line-height:1.7; margin-top:8px`

**1단계 필드** — 2열 그리드(`gap:14px`), 입력칸 `height:46px; border-radius:11px; padding:0 13px; font-size:13.5px; border:1px solid #E2E2E8`

| 라벨 | 표시 | 아래 설명 |
| --- | --- | --- |
| 상호 | 필수 | 인플루언서에게 이 이름으로 보여요. |
| 사업자등록번호 | 필수 | 조직 계정은 이 번호로 하나만 만들어집니다. |
| 담당자 이름 | 필수 | 회사명과 함께 인플루언서에게 보입니다. |
| 담당자 휴대폰 | 필수 | 양쪽 수락 후에만 공개돼요. |
| 회사 대표번호 | 선택 | — |
| 이메일 | 인증됨 | — (읽기전용) |

표시 배지 색: 필수 `#DC2626` / 선택 `#B0B0BB` / 인증됨 `#15803D` (`font-size:11px; font-weight:700`)
읽기전용 칸: `background:#F1F1F4; border-color:#EAEAEE; color:#9A9AA5`
아래 설명: `font-size:11px; color:#7C7C88; line-height:1.6; margin-top:6px`

> **사업자등록증 파일 업로드**를 이 단계에 추가하세요 (D7 5-1). 프로토타입은 「첫 캠페인 등록 때」로
> 미뤘지만, 관리자 승인 심사가 가입 직후에 일어나므로 여기서 받아야 합니다.

**2단계 팀 초대** — 초대 행 `border:1px solid #EAEAEE; border-radius:11px; padding:12px 14px`,
아바타 32px 원(`background:#F1F1F4; color:#9A9AA5`), 이메일 `12.5px/700`, 역할 `11px/#9A9AA5`
추가 버튼: `height:46px; border-radius:11px; border:1px dashed #D4D4DC; color:#B45309` 「＋ 이메일로 초대하기」
안내: `background:#FAFAFB; border-radius:11px; padding:13px 14px; font-size:11.5px; color:#7C7C88`
```
지금 안 하셔도 됩니다. 가입 후 「팀」 메뉴에서 언제든 초대할 수 있어요.
```
이 단계에는 **건너뛰기**가 있습니다.

**3단계 완료** — 검정 카드(`background:#17171B; border-radius:14px; padding:17px 18px`)

```
웰컴 크레딧                    [지급 완료]
20,000 (C)
캠페인 개설은 베타 기간 무료, 협업이 성사되면 10,000C를 더 드려요.
```
- 라벨 `11.5px/700 rgba(255,255,255,0.6)`, 배지 `background:rgba(245,158,11,0.2); color:#F59E0B`
- 숫자 `font-size:29px; font-weight:800; letter-spacing:-0.035em; color:#fff; font-variant-numeric:tabular-nums`
- C 원형: 23px, `background:#F59E0B; color:#17171B; font-size:13px; font-weight:800`
- ⚠️ 금액은 `creditConfig.ts` 의 `signupCreditAmount('advertiser')` 에서 읽으세요. 하드코딩 금지

다음 할 일 3줄 (앞에 5px amber 원, `font-size:12.5px; color:#3C3C46; line-height:1.65`):
```
첫 캠페인을 등록하거나, 날짜로 인플루언서를 찾아보세요
사업자등록증은 승인 심사에 쓰이고, 확인 즉시 삭제됩니다
대시 · 딜시트 확인 · 정산 기록은 폰에서도 됩니다
```

**CTA 라벨** — 1단계 「다음」 / 2단계 「가입 완료」 / 3단계 「캠페인 등록하러 가기」
3단계 CTA 는 **실제로 `/advertiser/dashboard` 로 넘깁니다.** 여기서 멈추면 가입이 안 끝난 것처럼 보입니다.

## 4-2. 인플루언서 — PC 에서는 QR 안내

```
src/app/(auth)/signup/page.tsx
```

PC 에서 인플루언서를 고르면 **가입 폼을 열지 말고** 모달을 띄웁니다.

```
인플루언서 가입은 앱에서 해주세요
채널 소유 확인과 오픈 등록이 폰에서 훨씬 빠릅니다.
아래 코드를 폰 카메라로 비추면 바로 가입 화면이 열려요.

[QR 118px]  matchpost.kr/app
```
- 제목 `font-size:17px; font-weight:800; letter-spacing:-0.025em`
- 설명 `font-size:12.5px; color:#5C5C68; line-height:1.7; margin-top:9px`
- QR 영역 `height:180px; border-radius:14px; background:#17171B`, 안에 118px 흰 테두리 사각 + `matchpost.kr/app` (`11px/rgba(255,255,255,0.5)`)

**아무 일도 안 하게 두면 안 됩니다.** 지금은 역할만 선택되고 끝입니다.

## 4-3. 인플루언서 모바일 가입 (5단계)

원본: `signup-onboarding-mobile.dc.html`

| 단계 | 받는 것 |
| --- | --- |
| 1 | 역할 선택 |
| 2 | 이메일 · 비밀번호 |
| 3 | 이름(실명) · 활동명 · 휴대폰 |
| 4 | 채널 인증 · 메이저 분야 1개 · 서브 분야 최대 2개 · 활동 지역 |
| 5 | 완료 — 가입 축하금 + 다음 할 일 |

- 분야 칩은 지금 구현이 이미 맞습니다 (메이저 1개 필수 / 서브 최대 2개)
- 5단계 문구: 「가입 축하금 10,000C 를 드렸어요. 오픈 등록은 베타 기간 무료, 협업이 성사되면 10,000C 를 더 드려요.」
- 다음 할 일: 「먼저 이번 달 가능한 날짜부터 열어보세요」 / 「프로필의 분야 · 지역을 채우면 추천이 정확해집니다」

---

# 5. 로그인 (`/login`)

지금 흰 카드 하나에 「MatchPost」 + 이메일 · 비밀번호뿐입니다.

- **랜딩 우측 패널과 같은 구성**으로 맞추세요 (역할 탭 + 소셜 3개 + 구분선 + 이메일)
- 「MatchPost」 → 로고 컴포넌트
- 부제 「인플루언서 · 광고주 매칭 플랫폼」 → 역할별 헤드라인(3-3 표)
- 하단에 `<Footer />`
- 실패 문구는 지금 것이 좋습니다 — 「이메일 또는 비밀번호가 올바르지 않아요.」 유지

---

# 6. 승인 대기 (`/pending`)

파일명 오타를 고친 뒤(D7 1-1), 내용도 다듬으세요.

- ⏳ 📋 이모지 제거
- 「MatchPost」 → 로고 컴포넌트
- 승인 절차 4단계는 유지. 다만 2번을 「서류 검토 (1~3 영업일)」에서
  「서류 검토 (1~3 영업일) · 확인 즉시 서류는 삭제됩니다」로 — 처리방침에 공개한 내용입니다
- 하단에 「문의: help@matchpost.kr」

---

# 7. 확인

- [ ] `/` 좌 검정 / 우 로그인 2단, 하단 사업자 정보
- [ ] `/` 에 실제 캘린더 데이터가 없다 (장식 격자이거나 아예 없음)
- [ ] `/intro` 가 정리됐다 (삭제 또는 `/` 로 통합)
- [ ] 로고가 마크 + `MATCH(원)POST` 로 7곳 모두 통일
- [ ] 점이 문자가 아니라 원이고 세로 중앙
- [ ] `/signup` 광고주 3단계, 진행바, 사업자등록번호 · 서류 업로드
- [ ] `/signup` PC 에서 인플루언서 선택 시 QR 모달
- [ ] `/login` 역할 탭 + 소셜 3개
- [ ] `/pending` 도달되고 이모지 없음
- [ ] 가입 축하금 금액이 `creditConfig.ts` 에서 나온다
