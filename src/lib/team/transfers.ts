'use server'

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import type { SupabaseClient } from '@supabase/supabase-js'

// 퇴사 · 이관 — D14 5절.
//
// 세 상태(활동중 / 인수인계 중='leaving' / 비활성='inactive')를 오가고,
// 담당 캠페인·개인 대화를 다른 사람에게 옮긴다.
//
// ⚠️ conversations 는 RLS(SELECT 정책만) 라 클라이언트 UPDATE 가 조용히 0행이 된다.
//    그래서 이관은 회사 소속을 코드로 확인한 뒤 service-role 클라이언트로 처리한다
//    (campaignMessage.ts 와 동일한 방식). campaigns 는 RLS 가 없어 자체로 갱신 가능하지만
//    한 곳에서 일관되게 다루려고 여기서도 service 로 쓴다.
//
// ⚠️ 캠페인에 딸린 대화(kind='campaign')는 캠페인과 함께 자동으로 따라간다(5-7).
//    개인 대화(kind='personal')는 회사 자산이라 대표(advertiser_id)가 보관한다.

export type TransferResult = { ok: true } | { ok: false; error: string }

// 회사 소속 여부 — 대표(owner_id 본인) 또는 team_members 행(허용 status).
async function isCompanyMember(
  db: SupabaseClient,
  advertiserId: string,
  userId: string,
  statuses: string[] = ['active', 'leaving'],
): Promise<boolean> {
  if (userId === advertiserId) return true
  const { data } = await db
    .from('team_members')
    .select('member_id')
    .eq('owner_id', advertiserId)
    .eq('member_id', userId)
    .in('status', statuses)
    .maybeSingle()
  return !!data
}

// 퇴사자에게 남은 담당이 하나도 없으면 자동으로 비활성 처리(5-3).
// 캠페인에 딸린 대화는 캠페인을 따라가므로 여기서 세지 않는다 — 캠페인 + 개인 대화만 센다.
async function inactivateIfEmpty(db: SupabaseClient, advertiserId: string, leaverId: string) {
  const { count: campCount } = await db
    .from('campaigns')
    .select('id', { count: 'exact', head: true })
    .eq('advertiser_id', advertiserId)
    .eq('manager_id', leaverId)
  const { count: convCount } = await db
    .from('conversations')
    .select('id', { count: 'exact', head: true })
    .eq('advertiser_id', advertiserId)
    .eq('kind', 'personal')
    .eq('manager_id', leaverId)
  if ((campCount ?? 0) === 0 && (convCount ?? 0) === 0) {
    await db
      .from('team_members')
      .update({ status: 'inactive' })
      .eq('owner_id', advertiserId)
      .eq('member_id', leaverId)
      .eq('status', 'leaving')
  }
}

// 대표만 — 「해제」 대신 「퇴사 예정으로 전환」. 합의한 퇴사일(leave_on)을 적는다(받는 사람 미지정).
export async function setLeaving(memberRowId: string, leaveOn: string): Promise<TransferResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: '로그인이 필요해요.' }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(leaveOn)) return { ok: false, error: '퇴사 예정일을 골라주세요.' }

  const { data: row } = await supabase
    .from('team_members')
    .select('id, owner_id, status')
    .eq('id', memberRowId)
    .maybeSingle()
  if (!row) return { ok: false, error: '팀원을 찾을 수 없어요.' }
  if (row.owner_id !== user.id) return { ok: false, error: '대표만 전환할 수 있어요.' }
  if (row.status !== 'active') return { ok: false, error: '활동중인 팀원만 전환할 수 있어요.' }

  const { error } = await supabase
    .from('team_members')
    .update({ status: 'leaving', leave_on: leaveOn })
    .eq('id', memberRowId)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

// 대표만 — 퇴사 예정 전환을 되돌린다(활동중으로).
export async function cancelLeaving(memberRowId: string): Promise<TransferResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: '로그인이 필요해요.' }

  const { data: row } = await supabase
    .from('team_members')
    .select('id, owner_id, status')
    .eq('id', memberRowId)
    .maybeSingle()
  if (!row) return { ok: false, error: '팀원을 찾을 수 없어요.' }
  if (row.owner_id !== user.id) return { ok: false, error: '대표만 되돌릴 수 있어요.' }
  if (row.status !== 'leaving') return { ok: false, error: '퇴사 예정 상태가 아니에요.' }

  const { error } = await supabase
    .from('team_members')
    .update({ status: 'active', leave_on: null })
    .eq('id', memberRowId)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

// 캠페인 이관 — 실행자는 퇴사자 본인·받는 사람·대표 누구든 회사 소속이면 된다.
// campaigns.manager_id 를 바꾸고, 딸린 대화(kind='campaign')도 함께 옮긴 뒤, 이관 이력을 남긴다.
export async function transferCampaign(
  campaignId: string,
  toId: string,
  memo?: string,
): Promise<TransferResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: '로그인이 필요해요.' }

  const db = createServiceClient()
  const { data: camp } = await db
    .from('campaigns')
    .select('id, advertiser_id, manager_id, title')
    .eq('id', campaignId)
    .maybeSingle()
  if (!camp) return { ok: false, error: '캠페인을 찾을 수 없어요.' }
  const adv = camp.advertiser_id as string
  const fromId = camp.manager_id as string | null

  if (!(await isCompanyMember(db, adv, user.id))) return { ok: false, error: '이관 권한이 없어요.' }
  if (!(await isCompanyMember(db, adv, toId, ['active', 'leaving', 'inactive']))) {
    return { ok: false, error: '받는 사람이 회사 팀원이 아니에요.' }
  }
  if (fromId === toId) return { ok: false, error: '이미 그 사람 담당이에요.' }

  const { error: e1 } = await db.from('campaigns').update({ manager_id: toId }).eq('id', campaignId)
  if (e1) return { ok: false, error: e1.message }

  // 딸린 캠페인 대화도 담당자를 따라가게 한다(있으면).
  await db
    .from('conversations')
    .update({ manager_id: toId })
    .eq('advertiser_id', adv)
    .eq('kind', 'campaign')
    .eq('campaign_id', campaignId)

  // 이관 이력(꼬리표·출처의 근거). 사람이 쓴 메모가 있으면 함께 남긴다.
  if (fromId) {
    await db.from('transfers').insert({
      from_id: fromId,
      to_id: toId,
      kind: 'campaign',
      ref_id: campaignId,
      memo: memo?.trim() || null,
      by_id: user.id,
    })
    // 5-9 담당자 교체 — 인플루언서 대화에 시스템 줄 + 알림.
    // 캠페인 대화는 (광고주·인플루언서·proposal)로 이미 이어져 있어 창을 새로 만들지 않는다.
    // 같은 창에 is_system 줄만 들어가고(말풍선 아님 → 발신자 이름 불변), 참여자에게 알림을 보낸다.
    await notifyManagerChange(db, adv, campaignId, (camp.title as string) || '', toId)
    await inactivateIfEmpty(db, adv, fromId)
  }
  return { ok: true }
}

// 담당자 교체를 캠페인 참여 인플루언서에게 알린다(5-9).
// 대상은 인플루언서별 최신 제안 1건 — send_campaign_message 브로드캐스트와 같은 대상.
async function notifyManagerChange(
  db: SupabaseClient,
  advertiserId: string,
  campaignId: string,
  campaignTitle: string,
  toId: string,
) {
  const { data: toProf } = await db.from('profiles').select('name').eq('id', toId).maybeSingle()
  const toName = (toProf?.name as string | null) || '담당자'

  const { data: props } = await db
    .from('proposals')
    .select('id, influencer_id, created_at')
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: false })
  const latestByInf = new Map<string, string>() // influencer_id → 최신 proposal_id
  for (const p of props ?? []) {
    const inf = p.influencer_id as string | null
    if (inf && !latestByInf.has(inf)) latestByInf.set(inf, p.id as string)
  }
  if (!latestByInf.size) return
  const pairs = [...latestByInf]

  const line = `담당자가 ${toName}님으로 바뀌었어요`
  const body = `${campaignTitle ? campaignTitle + ' — ' : ''}담당자가 ${toName}님으로 바뀌었어요.`

  await db.from('messages').insert(
    pairs.map(([inf, pid]) => ({
      sender_id: advertiserId,
      receiver_id: inf,
      proposal_id: pid,
      content: line,
      is_system: true,
    })),
  )
  await db.from('notifications').insert(
    pairs.map(([inf, pid]) => ({
      user_id: inf,
      type: 'manager_changed',
      kind: 'manager_changed',
      title: '담당자가 바뀌었어요',
      body,
      link: `/influencer/messages?receiverId=${advertiserId}&proposalId=${pid}`,
      ref_type: 'campaign',
      ref_id: campaignId,
      state: 'unread',
    })),
  )
}

// 개인 대화 이관 — 항상 대표(advertiser_id)가 보관한다(5-7). 받는 사람 지정 없음.
export async function transferConversation(conversationId: string): Promise<TransferResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: '로그인이 필요해요.' }

  const db = createServiceClient()
  const { data: conv } = await db
    .from('conversations')
    .select('id, advertiser_id, kind, manager_id')
    .eq('id', conversationId)
    .maybeSingle()
  if (!conv) return { ok: false, error: '대화를 찾을 수 없어요.' }
  if (conv.kind !== 'personal') return { ok: false, error: '개인 대화만 옮길 수 있어요.' }
  const adv = conv.advertiser_id as string
  const fromId = conv.manager_id as string | null

  if (!(await isCompanyMember(db, adv, user.id))) return { ok: false, error: '이관 권한이 없어요.' }
  if (fromId === adv) return { ok: false, error: '이미 대표가 보관 중이에요.' }

  const { error: e1 } = await db.from('conversations').update({ manager_id: adv }).eq('id', conversationId)
  if (e1) return { ok: false, error: e1.message }

  if (fromId) {
    await db.from('transfers').insert({
      from_id: fromId,
      to_id: adv,
      kind: 'conversation',
      ref_id: conversationId,
      by_id: user.id,
    })
    await inactivateIfEmpty(db, adv, fromId)
  }
  return { ok: true }
}
