import { defineConfig, devices } from '@playwright/test'

// 실행 1건을 식별하는 값. 테스트가 실패하면 Playwright 는 워커를 버리고 새로 띄우는데,
// 새 워커는 파일을 다시 읽는다 → 모듈 최상단에서 Date.now() 로 만들면 값이 달라진다.
// (실제로 0-1 에서 초대한 bot+team-* 을 0-6 이 못 찾는 「가짜 실패」가 여기서 났다)
// 설정 파일은 실행당 한 번만 평가되고 워커는 이 env 를 물려받으므로 여기서 고정한다.
if (!process.env.BOT_RUN) process.env.BOT_RUN = String(Date.now()).slice(-8)

// 기본은 로컬. E2E_BASE_URL 을 줄 때만 다른 곳을 본다(사용자 지시: 배포본에서도 한 번 확인).
// ⚠️ 배포본에 돌릴 때는 계정을 만드는 시나리오(00-signup)를 쓰지 말 것 — 실제 DB 에 쌓인다.
//    읽기만 하는 점검(20-loading 등)에만 쓴다.
const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:3000'

// D23 봇 — 로컬(localhost:3000)에서 돈다. 배포본에 돌리면 실제 DB에 봇 계정이 쌓인다.
//
// headless: false — 「막다른 길」과 「직관성」은 로그로 안 보인다.
//   로그엔 「버튼 클릭 성공」인데 화면엔 아무 일도 안 일어나는 경우가 바로 그것이라
//   창이 실제로 열려야 한다.
// workers: 1 — 시나리오가 순서대로 흐른다(앞 단계 결과가 뒤 단계 입력).
// retries: 0 — 재시도로 가려지면 「가끔 막히는 자리」를 못 본다.
export default defineConfig({
  testDir: './tests/e2e',
  outputDir: './tests/.output',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: [['list']],

  use: {
    baseURL: BASE_URL,
    headless: false,
    locale: 'ko-KR',
    timezoneId: 'Asia/Seoul',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    trace: 'retain-on-failure',
    video: 'off',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],

  // 이미 dev 서버가 떠 있으면 그걸 쓴다. 없으면 띄운다(첫 컴파일이 느려 넉넉히 잡음).
  // 배포본을 볼 때는 띄울 이유가 없다.
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: 'npm run dev',
        url: 'http://localhost:3000',
        reuseExistingServer: true,
        timeout: 180_000,
      },
})
