import fs from 'node:fs'
import path from 'node:path'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Browser, BrowserContext, Page } from '@playwright/test'

export const ROOT = path.resolve(__dirname, '../..')
export const SHOTS = path.join(ROOT, 'tests', 'screenshots')
export const FIXTURES = path.join(ROOT, 'tests', 'fixtures')
export const ACCOUNTS_FILE = path.join(ROOT, 'tests', '.accounts.json')

// ── .env.local 로더 ────────────────────────────────────────────────
// Playwright 는 next 처럼 .env.local 을 자동으로 안 읽는다. dotenv 의존성을 새로
// 넣지 않으려고 최소 파서만 둔다(따옴표 · 주석 · export 접두어 정도만 처리).
export function loadEnvLocal() {
  const file = path.join(ROOT, '.env.local')
  if (!fs.existsSync(file)) return
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line)
    if (!m) continue
    let v = m[2].trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    if (process.env[m[1]] === undefined) process.env[m[1]] = v
  }
}

export function serviceClient(): SupabaseClient {
  loadEnvLocal()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('.env.local 에 NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 가 필요해요.')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

// ── 사업자등록번호 ─────────────────────────────────────────────────
// 국세청 체크섬을 통과하는 번호를 만든다. 중복 검사가 있으니 매 실행마다 다른 값이어야 해서
// 실행 시각을 씨앗으로 쓴다. (src/lib/business-number.ts 의 isValidBizNo 와 같은 규칙)
export function makeBizNo(seed: number = Date.now()): string {
  const W = [1, 3, 7, 1, 3, 7, 1, 3, 5]
  const base = String(seed).padStart(9, '0').slice(-9)
  const d = base.split('').map(Number)
  let sum = 0
  for (let i = 0; i < 9; i++) sum += W[i] * d[i]
  sum += Math.floor((d[8] * 5) / 10)
  const check = (10 - (sum % 10)) % 10
  return `${base.slice(0, 3)}-${base.slice(3, 5)}-${base.slice(5, 9)}${check}`
}

// ── 스크린샷 ───────────────────────────────────────────────────────
// 단계마다 남긴다. 「버튼은 눌렸는데 화면은 그대로」인 자리는 로그로 안 보인다.
export async function shot(page: Page, name: string) {
  fs.mkdirSync(SHOTS, { recursive: true })
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: true })
}

// ── 만든 계정 기록 ─────────────────────────────────────────────────
// 실행이 끝나면 목록을 보고한다. 지울지 남길지는 사람이 정한다(자동 삭제 안 함).
export type MadeAccount = { role: string; email: string; password: string; note?: string }

// 파일에서 읽고 → 더하고 → 다시 쓴다. 메모리에만 모으면 워커가 갈릴 때
// 앞 단계에서 만든 계정이 목록에서 통째로 사라진다(실제로 그렇게 됐다).
// 이번 실행(RUN) 것만 남긴다 — 지난 실행 계정까지 쌓이면 목록을 못 믿는다.
export function madeAccounts(): MadeAccount[] {
  try {
    const rows = JSON.parse(fs.readFileSync(ACCOUNTS_FILE, 'utf8')) as MadeAccount[]
    return rows.filter((r) => r.email.includes(RUN))
  } catch {
    return []
  }
}

export function remember(acc: MadeAccount) {
  const rows = madeAccounts()
  if (!rows.some((r) => r.email === acc.email)) rows.push(acc)
  fs.mkdirSync(path.dirname(ACCOUNTS_FILE), { recursive: true })
  fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(rows, null, 2), 'utf8')
}

// 실행마다 겹치지 않는 이메일. bot+ 접두어라 나중에 한 번에 지우기 쉽다.
// 값은 playwright.config.ts 에서 실행당 한 번 정한다 — 워커가 재시작돼도 같아야
// 앞 단계에서 만든 계정을 뒤 단계가 찾는다.
export const RUN = process.env.BOT_RUN ?? String(Date.now()).slice(-8)
export const PASSWORD = 'BotTest!2026'
export const botEmail = (tag: string) => `bot+${tag}-${RUN}@matchpost.kr`

// ── 봇 전용 관리자 ─────────────────────────────────────────────────
// 기존 운영 관리자로는 로그인조차 하지 않는다(사용자 지시). 봇은 자기 계정을 쓴다.
// RUN 접미어를 안 붙인다 — 승인 이력이 실행마다 흩어지면 관리자 화면을 못 읽는다.
export const ADMIN = { email: 'bot+admin@matchpost.kr', password: PASSWORD, name: '봇운영' }

export async function ensureBotAdmin(): Promise<string> {
  const db = serviceClient()
  const { data: list } = await db.auth.admin.listUsers({ page: 1, perPage: 200 })
  let id = list?.users.find((u) => (u.email ?? '').toLowerCase() === ADMIN.email)?.id

  if (!id) {
    const { data, error } = await db.auth.admin.createUser({
      email: ADMIN.email,
      password: ADMIN.password,
      email_confirm: true, // 메일 인증은 사람이 따로 확인한다(D23 0절)
    })
    if (error) throw new Error(`봇 관리자 생성 실패: ${error.message}`)
    id = data.user.id
  }

  // 가입 트리거가 만든 행이 있을 수도 있어 upsert 로 role 만 확실히 맞춘다.
  const { error: pErr } = await db
    .from('profiles')
    .upsert({ id, role: 'admin', name: ADMIN.name, status: 'approved' }, { onConflict: 'id' })
  if (pErr) throw new Error(`봇 관리자 profiles 설정 실패: ${pErr.message}`)
  return id
}

// ── 발견 기록 ──────────────────────────────────────────────────────
// 「고쳐야 할 버그」와 「사람이 헷갈리는 자리」는 다르다. 후자를 테스트 실패로 만들면
// 거기서 흐름이 끊겨 뒤를 못 본다. 그래서 파일에 쌓고 실행이 끝난 뒤 한 번에 읽는다.
// (워커가 갈려도 남아야 해서 메모리가 아니라 파일이다 — 계정 목록에서 이미 겪었다)
export type FindingKind = '결함' | '직관' | '로딩'
export type Finding = { kind: FindingKind; where: string; text: string; at: string }
export const FINDINGS_FILE = path.join(ROOT, 'tests', '.findings.json')

export function findings(): Finding[] {
  try {
    return JSON.parse(fs.readFileSync(FINDINGS_FILE, 'utf8')) as Finding[]
  } catch {
    return []
  }
}

export function finding(kind: FindingKind, where: string, text: string) {
  const rows = findings()
  if (!rows.some((r) => r.kind === kind && r.where === where && r.text === text)) {
    rows.push({ kind, where, text, at: new Date().toISOString() })
  }
  fs.mkdirSync(path.dirname(FINDINGS_FILE), { recursive: true })
  fs.writeFileSync(FINDINGS_FILE, JSON.stringify(rows, null, 2), 'utf8')
  console.log(`[${kind}] ${where} — ${text}`)
}

// ── DB 조회 ────────────────────────────────────────────────────────
// 「눌렀다」가 아니라 「값이 바뀌었다」를 보려면 화면 말고 DB 를 읽어야 한다(D23 1절).
export async function userIdByEmail(email: string): Promise<string> {
  const db = serviceClient()
  const { data } = await db.auth.admin.listUsers({ page: 1, perPage: 300 })
  const id = data?.users.find((u) => (u.email ?? '').toLowerCase() === email.toLowerCase())?.id
  if (!id) throw new Error(`계정을 못 찾았어요: ${email} — 00-signup 을 같은 BOT_RUN 으로 먼저 돌렸나요?`)
  return id
}

export type LedgerRow = { id: string; delta: number; kind: string; reason_code: string; memo: string | null; created_at: string }

export async function ledger(userId: string): Promise<LedgerRow[]> {
  const db = serviceClient()
  const { data, error } = await db
    .from('credit_ledger')
    .select('id, delta, kind, reason_code, memo, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(`원장 조회 실패: ${error.message}`)
  return (data ?? []) as LedgerRow[]
}

// ── 로그인 ─────────────────────────────────────────────────────────
// 단계마다 새 컨텍스트로 직접 로그인한다. 앞 테스트가 만든 컨텍스트를 물려쓰면
// 앞이 실패해 워커가 갈릴 때 뒤가 「알 수 없는 이유」로 무너진다.
export async function loginAs(
  browser: Browser,
  email: string,
  password: string,
  waitUrl: string,
): Promise<{ ctx: BrowserContext; page: Page }> {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()
  await page.goto('/login')
  await page.getByPlaceholder('이메일').fill(email)
  await page.getByPlaceholder('비밀번호').fill(password)
  await page.getByRole('button', { name: '로그인' }).click()
  await page.waitForURL(waitUrl, { timeout: 45_000 })
  return { ctx, page }
}
