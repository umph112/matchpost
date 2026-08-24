'use server'

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

// 상수도 타입도 ./types 에 있다 — 'use server' 파일은 async 함수만 export 할 수 있다(이유는 그 파일 주석).
// ⚠️ `export type { ReportType }` 로 되넘기는 것도 안 된다 — 이유는
// src/lib/cancellations/actions.ts 주석 참고(런타임 re-export 로 나가서 번들이 죽는다).
import type { ReportType } from './types'

export type ReportResult = { ok: true; id: string } | { ok: false; error: string }

export async function fileReport(
  sourceType: 'proposal' | 'campaign',
  sourceId: string,
  type: ReportType,
  body: string,
): Promise<ReportResult> {
  const auth = await createClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return { ok: false, error: '로그인이 필요해요.' }
  if (!body.trim()) return { ok: false, error: '내용을 입력해주세요.' }

  const db = createServiceClient()
  const { data, error } = await db.rpc('file_report', {
    p_reporter_id: user.id,
    p_source_type: sourceType,
    p_source_id: sourceId,
    p_type: type,
    p_body: body.trim(),
  })

  if (error) {
    if (error.message.includes('not a party'))       return { ok: false, error: '해당 건의 당사자만 신고할 수 있어요.' }
    if (error.message.includes('cannot report own')) return { ok: false, error: '본인 캠페인은 신고할 수 없어요.' }
    return { ok: false, error: error.message }
  }
  return { ok: true, id: data as string }
}

export async function resolveReport(reportId: string): Promise<ReportResult> {
  const auth = await createClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return { ok: false, error: '로그인이 필요해요.' }

  const db = createServiceClient()
  const { error } = await db.rpc('resolve_report', { p_report_id: reportId, p_reporter_id: user.id })
  if (error) return { ok: false, error: '이미 처리됐거나 권한이 없어요.' }
  return { ok: true, id: reportId }
}

export async function reopenReport(reportId: string): Promise<ReportResult> {
  const auth = await createClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return { ok: false, error: '로그인이 필요해요.' }

  const db = createServiceClient()
  const { error } = await db.rpc('reopen_report', { p_report_id: reportId, p_reporter_id: user.id })
  if (error) return { ok: false, error: '다시 열 수 없는 상태예요(7일이 지났거나 이미 열려 있어요).' }
  return { ok: true, id: reportId }
}

async function requireAdminUser() {
  const auth = await createClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return { ok: false as const, error: '로그인이 필요해요.' }

  const { data: profile } = await auth.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return { ok: false as const, error: '관리자 권한이 필요해요.' }
  return { ok: true as const, userId: user.id }
}

export async function adminCloseReport(reportId: string, closeReason: string): Promise<ReportResult> {
  const admin = await requireAdminUser()
  if (!admin.ok) return { ok: false, error: admin.error }
  if (!closeReason.trim()) return { ok: false, error: '종결 사유를 입력해주세요.' }

  const db = createServiceClient()
  const { error } = await db.rpc('admin_close_report', {
    p_report_id: reportId, p_admin_id: admin.userId, p_close_reason: closeReason.trim(),
  })
  if (error) return { ok: false, error: error.message }
  return { ok: true, id: reportId }
}

export async function adminEscalateReport(reportId: string): Promise<ReportResult> {
  const admin = await requireAdminUser()
  if (!admin.ok) return { ok: false, error: admin.error }

  const db = createServiceClient()
  const { error } = await db.rpc('admin_escalate_report', {
    p_report_id: reportId, p_admin_id: admin.userId,
  })
  if (error) return { ok: false, error: error.message }
  return { ok: true, id: reportId }
}
