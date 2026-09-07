# D33 — 두 폭 실측

셸 판정을 user-agent 에서 화면 폭(lg = 1024px)으로 바꾼 뒤 잰 값입니다.
캡처는 `screens/pc/` · `screens/mobile/` 에 같은 이름으로 있습니다(각 45장).

- **본문** — `main` 폭. 그게 없는 화면은 body 아래에서 폭을 가진 첫 칸
- **내용** — `main` 이 없는 화면에서 스스로 폭을 제한한 가장 바깥 칸. 바깥 래퍼만 보면 갇힌 화면이 안 갇힌 것처럼 보인다
- **첫칸** — 본문의 첫 자식. PC 에서 이 값이 작으면 「한 줄에 항목 하나」인지 캡처로 볼 자리

추측이 아니라 `getBoundingClientRect()` 값입니다.

| 화면 | 주소 | PC 본문 | PC 내용 | PC 첫칸 | PC 사이드바 | 모바일 본문 | 모바일 첫칸 | 모바일 하단탭 | 모바일 가로스크롤 |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| pub-home | / | 1440px | 560px | 980px | — | 390px | 390px | — |  |
| pub-intro | /intro ↪ / | 1440px | 560px | 980px | — | 390px | 390px | — |  |
| pub-login | /login | 1440px | 420px | 1440px | — | 390px | 390px | — |  |
| pub-signup | /signup | 1440px | 1024px | 1440px | — | 390px | 390px | — |  |
| pub-pending | /pending | 1440px | 406px | 1440px | — | 390px | 390px | — |  |
| pub-terms | /terms | 768px | 768px | 720px | — | 390px | 342px | — |  |
| pub-privacy | /privacy | 768px | 768px | 720px | — | 390px | 342px | — |  |
| adv-dashboard | /advertiser/dashboard | 1204px | 1204px | 1148px | 236px | 390px | 358px | — |  |
| adv-campaigns | /advertiser/campaigns | 1204px | 1204px | 1148px | 236px | 390px | 358px | — |  |
| adv-campaign-new | /advertiser/campaigns/new | 1204px | 1204px | 1148px | 236px | 390px | 358px | — |  |
| adv-connections | /advertiser/connections | 1204px | 1204px | 399px | 236px | 390px | 358px | — |  |
| adv-messages | /advertiser/messages | 1204px | 1204px | 1148px | 236px | 390px | 390px | — |  |
| adv-notifications | /advertiser/notifications | 1204px | 1204px | 439px | 236px | 390px | 358px | — |  |
| adv-proposal-new | /advertiser/proposals/new | 1204px | 1204px | 275px | 236px | 390px | 358px | — |  |
| adv-search | /advertiser/search | 1204px | 1204px | 1148px | 236px | 390px | 358px | — |  |
| adv-settlements | /advertiser/settlements | 1204px | 1204px | 1148px | 236px | 390px | 358px | — |  |
| adv-team | /advertiser/team | 1204px | 1204px | 756px | 236px | 390px | 358px | — |  |
| adv-team-leaves | /advertiser/team/leaves | 1204px | 1204px | 1148px | 236px | 390px | 358px | — | ⚠️ div. →398px |
| adv-team-workload | /advertiser/team/workload | 1204px | 1204px | 1148px | 236px | 390px | 358px | — |  |
| adv-day | /day/2026-09-07 | 1440px | 512px | 512px | — | 390px | 390px | — |  |
| adv-credits | /credits | 1100px | 1100px | 1068px | — | 390px | 358px | — |  |
| adv-credits-about | /credits/about | 920px | 920px | 888px | — | 375px | 343px | — |  |
| adv-profile | /profile | 1440px | 1440px | — | — | 390px | — | — |  |
| adv-message-detail | /advertiser/messages/502d50c5-6bf7-442e-b856-e0bfa0ee0700 | 1204px | 1204px | 1148px | 236px | 390px | 390px | — |  |
| inf-dashboard | /influencer/dashboard | 1204px | 1204px | — | 236px | 390px | 358px | 390px |  |
| inf-earnings | /influencer/earnings | 1204px | 1204px | 634px | 236px | 390px | 358px | 390px |  |
| inf-proposals | /influencer/proposals | 1204px | 1204px | 289px | 236px | 390px | 358px | 390px |  |
| inf-profile | /influencer/profile | 1204px | 1204px | 1148px | 236px | 390px | 358px | 390px |  |
| inf-notifications | /influencer/notifications | 1204px | 1204px | 439px | 236px | 390px | 358px | 390px |  |
| inf-search | /influencer/search | 1204px | 1204px | 1148px | 236px | 390px | 358px | 390px |  |
| inf-channel-analytics | /influencer/channel-analytics | 1204px | 1204px | 1148px | 236px | 390px | 358px | 390px |  |
| inf-schedule-new | /influencer/schedule | 1204px | 1204px | 771px | 236px | 390px | 358px | 390px |  |
| inf-schedule-list | /influencer/schedule/list | 1204px | 1204px | 234px | 236px | 390px | 358px | 390px |  |
| inf-messages | /influencer/messages | 1204px | 1204px | 1148px | 236px | 390px | 390px | 390px |  |
| inf-day | /day/2026-09-07 | 1440px | 512px | 512px | — | 390px | 390px | — |  |
| inf-schedule-detail | /influencer/schedule/7b241376-fe8d-4c95-a8bd-3c164448952d | 1204px | 1204px | 1148px | 236px | 390px | 358px | 390px |  |
| inf-message-detail | /influencer/messages/502d50c5-6bf7-442e-b856-e0bfa0ee0700 | 1204px | 1204px | 1148px | 236px | 390px | 390px | 390px |  |
| pub-influencer-detail | /influencer/2ae784fe-60cf-4801-8c2a-dff7f8d63cff | 672px | 672px | 117px | — | 390px | 117px | — |  |
| pub-advertiser-detail | /advertiser/abbb55f9-b237-40d2-8352-4a659ee0d9c2 | 1440px | 1080px | 1080px | — | 390px | 358px | — |  |
| admin-dashboard | /admin/dashboard | 1204px | 1204px | 1148px | 236px | 1124px | 1068px | — | ⚠️ div.min-w-[1360px].flex.bg-[#F4F4F6].min-h-screen →1360px |
| admin-users | /admin/users | 1204px | 1204px | 1148px | 236px | 1124px | 1068px | — | ⚠️ div.min-w-[1360px].flex.bg-[#F4F4F6].min-h-screen →1360px |
| admin-credits | /admin/credits | 1204px | 1204px | 1148px | 236px | 1124px | 1068px | — | ⚠️ div.min-w-[1360px].flex.bg-[#F4F4F6].min-h-screen →1360px |
| admin-credits-policy | /admin/credits/policy | 1204px | 1204px | 1148px | 236px | 1124px | 1068px | — | ⚠️ div.min-w-[1360px].flex.bg-[#F4F4F6].min-h-screen →1360px |
| admin-reports | /admin/reports | 1204px | 1204px | 1148px | 236px | 1124px | 1068px | — | ⚠️ div.min-w-[1360px].flex.bg-[#F4F4F6].min-h-screen →1360px |
| admin-sanctions | /admin/sanctions | 1204px | 1204px | 1148px | 236px | 1124px | 1068px | — | ⚠️ div.min-w-[1360px].flex.bg-[#F4F4F6].min-h-screen →1360px |

## 못 본 화면

데이터가 없어 열지 못했습니다. 「다 봤다」가 거짓이 되지 않게 적어 둡니다.

- adv-campaign-detail — 이 계정에 캠페인이 없어요 (미검증)
- adv-deal — 대시보드에 딜시트 링크가 없어요 (미검증)
- adv-handover — 이관 대기자가 없어요 (미검증)
- inf-deal — 대시보드에 딜시트 링크가 없어요 (미검증)
- admin-report-detail — 신고가 없어요 (미검증)
