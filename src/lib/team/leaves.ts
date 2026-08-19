'use server'

import { createClient } from '@/lib/supabase/server'
import { resolveCompany } from '@/lib/team/company'

// 휴무 · 대행 — D14 4절.
// leaves RLS(0084)는 이미 당사자(member_id)와 회사(advertiser_id) 두 사람만 읽고/쓰게 막아둔다.
// RLS만으로는 "수락은 대표만 · 답은 당사자만" 같은 상태 전이 권한이 안 갈리므로 여기서 역할을 확인한다.
// (settle.ts 와 같은 방식 — resolveCompany 로 회사/대표 여부를 판별한다.)

export type LeaveResult = { ok: true } | { ok: false; error: string }

const KINDS = ['연차', '반차', '병가', '기타']

// 팀원 휴무 신청 — 본인(member_id)이 소속 회사(advertiser_id) 앞으로 pending 을 만든다.
export async function requestLeave(input: {
  fromDate: string
  toDate: string
  kind: string
  reason?: string
}): Promise<LeaveResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: '로그인이 필요해요.' }

  const from = input.fromDate
  const to = input.toDate
  if (!from || !to) return { ok: false, error: '날짜를 골라주세요.' }
  const lo = from <= to ? from : to
  const hi = from <= to ? to : from
  if (!KINDS.includes(input.kind)) return { ok: false, error: '휴무 종류를 확인해주세요.' }

  const company = await resolveCompany(supabase, user.id)
  const { error } = await supabase.from('leaves').insert({
    advertiser_id: company.advertiserId,
    member_id: user.id,
    from_date: lo,
    to_date: hi,
    kind: input.kind,
    reason: input.reason?.trim() || null,
    status: 'pending',
  })
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

// 대표 수락 + 대행자 지정. 대행자는 원칙적으로 필수지만(호출부에서 강제),
// 걸린 일이 0건이면 대행자 없이(null) 수락할 수 있다.
export async function approveLeave(leaveId: string, substituteId: string | null): Promise<LeaveResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: '로그인이 필요해요.' }

  const company = await resolveCompany(supabase, user.id)
  if (!company.isOwner) return { ok: false, error: '수락 권한이 없어요.' }

  const { data: leave } = await supabase
    .from('leaves')
    .select('id, advertiser_id')
    .eq('id', leaveId)
    .maybeSingle()
  if (!leave || leave.advertiser_id !== company.advertiserId) {
    return { ok: false, error: '휴무 신청을 찾을 수 없어요.' }
  }

  const { error } = await supabase
    .from('leaves')
    .update({ status: 'approved', substitute_id: substituteId })
    .eq('id', leaveId)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

// 반려는 거절이 아니라 질문 — 메모 필수. status='rejected' 로 두고 메모를 쌓는다(4-6).
export async function rejectLeave(leaveId: string, memo: string): Promise<LeaveResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: '로그인이 필요해요.' }

  const text = memo.trim()
  if (!text) return { ok: false, error: '무엇이 걸리는지 적어주세요.' }

  const company = await resolveCompany(supabase, user.id)
  if (!company.isOwner) return { ok: false, error: '처리 권한이 없어요.' }

  const { data: leave } = await supabase
    .from('leaves')
    .select('id, advertiser_id')
    .eq('id', leaveId)
    .maybeSingle()
  if (!leave || leave.advertiser_id !== company.advertiserId) {
    return { ok: false, error: '휴무 신청을 찾을 수 없어요.' }
  }

  const { error: e1 } = await supabase
    .from('leave_notes')
    .insert({ leave_id: leaveId, author_id: user.id, text })
  if (e1) return { ok: false, error: e1.message }

  const { error: e2 } = await supabase.from('leaves').update({ status: 'rejected' }).eq('id', leaveId)
  if (e2) return { ok: false, error: e2.message }
  return { ok: true }
}

// 팀원이 반려에 답하고 다시 올린다 — 메모를 쌓고 status='replied' 로. 대표가 다시 판단한다.
export async function replyLeave(leaveId: string, text: string): Promise<LeaveResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: '로그인이 필요해요.' }

  const body = text.trim()
  if (!body) return { ok: false, error: '답을 적어주세요.' }

  const { data: leave } = await supabase
    .from('leaves')
    .select('id, member_id, status')
    .eq('id', leaveId)
    .maybeSingle()
  if (!leave || leave.member_id !== user.id) return { ok: false, error: '내 휴무 신청이 아니에요.' }
  if (leave.status !== 'rejected') return { ok: false, error: '답할 수 있는 상태가 아니에요.' }

  const { error: e1 } = await supabase
    .from('leave_notes')
    .insert({ leave_id: leaveId, author_id: user.id, text: body })
  if (e1) return { ok: false, error: e1.message }

  const { error: e2 } = await supabase.from('leaves').update({ status: 'replied' }).eq('id', leaveId)
  if (e2) return { ok: false, error: e2.message }
  return { ok: true }
}
