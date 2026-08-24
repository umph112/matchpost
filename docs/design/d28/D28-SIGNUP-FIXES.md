# D28 — 가입·프로필 수정

실제로 사이트에서 가입해보다가 발견한 것들. 2026-08-24.

> ⚠️ 이 파일은 전달받은 원본이 인코딩이 깨진 채로 도착해서 내용 기준으로 다시 옮겨 적은 것입니다.
> 문구가 정확해야 하면 원본 `handoff_D28/D28-SIGNUP-FIXES.md` 로 교체해주세요.

---

## [1] PC에서 입력한 글자가 흐림

`signup/page.tsx:15` 의 `inputCls` 에 크기는 있는데 `color` 가 없다. 그래서 색을 상속받는다.

`text-[#17171B]` 와 `placeholder:text-[#B0B0BB]` 를 넣을 것.

`influencer/profile` 의 입력칸 7개 남짓도 같은 상태다. 같이 고칠 것.

> ⚠️ 입력칸은 색을 상속받게 두지 마. 입력값은 화면에서 가장 진해야 하는 글자야.

---

## [2] PC에서 인플루언서 가입이 막혀 있음

`isPc` 면 `InfluencerQrGate` 로 보낸다. 그런데 그 QR은 실제 이미지가 없는 빈 사각형이고,
`matchpost.kr/app` 은 존재하지도 않는다. 즉 PC에서는 가입할 방법이 없다.

게이트를 없애고 PC·모바일 모두 `InfluencerSignup` 으로 갈 것.
앱 권유는 폼 위 한 줄로 남기면 된다.

> ⚠️ 지금 테스트 중이라 PC 가입이 막혀 있으면 확인 자체를 못 해.

---

## [3] 가입 때 넣은 걸 프로필에서 또 넣음

① 활동명(activityName)을 고칠 곳이 없다. 그런데 이게 상대에게 보이는 이름이다.
「기본 정보」에 입력칸을 추가할 것.

② 분야를 두 번 고른다. 가입에서는 메이저 1 + 서브 2, 프로필에서는 「콘텐츠 카테고리」.
같은 컬럼인지 먼저 확인하고, 같으면 불러오기만 추가, 다르면 어느 쪽이 원본인지 정해서 하나로 합칠 것.

> 두 곳에 두면 어느 게 참인지 몰라.

> ⚠️ 프로필은 가입에서 받은 값이 채워진 상태로 열려야 해. 빈 칸으로 열리면 「또 입력하라는 건가」로 읽혀.

---

## [4] 저장 후 아무 일도 안 일어남

`handleSave` 가 `setSuccess(true)` 만 한다.
특히 블로그 URL을 처음 넣은 직후가 그렇다 — 「채널을 등록했어요」 카드는 뜨는데 그다음 길이 없다.

**첫 등록일 때만**(`savedBlogUrl` 이 비어 있었다가 채워짐) 그 카드 안에 「내 채널 분석 보기 →」를 넣을 것.
그 외 저장은 지금처럼 「저장됐어요!」 그대로.

> ⚠️ 매번 이동시키면 여러 항목을 고칠 때 방해가 돼.

---

## 5절 — 확인

```
grep -n "text-\[#17171B\]" src/app/\(auth\)/signup/page.tsx
grep -rn 'border-gray-200 rounded-lg px-4 py-2.5 text-sm"' src/app
grep -n "InfluencerQrGate" src/app/\(auth\)/signup/page.tsx
grep -n "activityName\|activity_name" src/app/\(dashboard\)/influencer/profile/page.tsx
grep -rn "categories" src/app/api/signup/route.ts src/app/\(dashboard\)/influencer/profile
```

브라우저

- PC에서 `/signup` → 인플루언서 → 폼이 바로 뜨는지
- 입력한 글자가 진한지
- 가입 후 `/influencer/profile` 이 활동명·분야가 채워진 채로 열리는지
- 블로그 URL 처음 저장 → 카드 안에 「내 채널 분석 보기 →」가 뜨는지
- 그다음 저장에는 안 뜨는지
