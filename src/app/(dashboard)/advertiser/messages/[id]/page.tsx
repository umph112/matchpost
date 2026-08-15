'use client'

import { useState, useEffect, useRef, useCallback, type ChangeEvent } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { ArrowLeft, Users, Paperclip, Loader2 } from 'lucide-react'
import DealConfirmBar from '@/components/DealConfirmBar'
import MessageBubble from '@/components/messages/MessageBubble'
import ReportModal from '@/components/ReportModal'
import { initial } from '@/lib/initial'
import { acceptDateProposal } from '@/lib/deals/time'
import { sendCampaignMessage } from '@/lib/deals/campaignMessage'
import { checkConversationPermission } from '@/lib/permissions'

type Participant = { influencerId: string; name: string; proposalId: string; confirmed: boolean; proposedDate: string | null; startAt: string | null }

export default function AdvertiserMessageRoomPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const supabase = createClient()

  const [currentUser, setCurrentUser] = useState<any>(null)
  const [conv, setConv] = useState<any>(null)
  const [campaignTitle, setCampaignTitle] = useState('')
  const [participants, setParticipants] = useState<Participant[]>([])
  const [otherName, setOtherName] = useState('')
  const [otherId, setOtherId] = useState<string | null>(null)
  const [singleProposalId, setSingleProposalId] = useState<string | null>(null)
  const [singleProposalState, setSingleProposalState] = useState<{ proposedDate: string | null; startAt: string | null } | null>(null)
  const [managerName, setManagerName] = useState<string | null>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [targetedId, setTargetedId] = useState<string | null>(null)
  const [confirmTargeted, setConfirmTargeted] = useState<Participant | null>(null)
  const [reportOpen, setReportOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [markAsGuide, setMarkAsGuide] = useState(true)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setCurrentUser(user)

    const { data: c } = await supabase.from('conversations').select('*').eq('id', id).single()
    if (!c) { setLoading(false); return }
    setConv(c)

    if (c.manager_id) {
      const { data: mgr } = await supabase.from('profiles').select('name').eq('id', c.manager_id).single()
      setManagerName(c.manager_id === c.advertiser_id ? '나' : mgr?.name ?? '담당자')
    } else {
      setManagerName(null)
    }

    if (c.kind === 'campaign') {
      const { data: camp } = await supabase.from('campaigns').select('title').eq('id', c.campaign_id).single()
      setCampaignTitle(camp?.title ?? '캠페인')

      const { data: props } = await supabase
        .from('proposals')
        .select('id, influencer_id, advertiser_confirmed, influencer_confirmed, proposed_date, start_at')
        .eq('campaign_id', c.campaign_id)
      const infIds = [...new Set((props ?? []).map((p) => p.influencer_id))]
      const { data: profs } = infIds.length
        ? await supabase.from('profiles').select('id, name').in('id', infIds)
        : { data: [] }
      const nameById = Object.fromEntries((profs ?? []).map((p) => [p.id, p.name]))
      const list: Participant[] = (props ?? []).map((p) => ({
        influencerId: p.influencer_id,
        name: nameById[p.influencer_id] ?? '인플루언서',
        proposalId: p.id,
        confirmed: !!(p.advertiser_confirmed && p.influencer_confirmed),
        proposedDate: p.proposed_date,
        startAt: p.start_at,
      }))
      setParticipants(list)

      const proposalIds = list.map((p) => p.proposalId)
      const { data: msgs } = proposalIds.length
        ? await supabase.from('messages').select('*').in('proposal_id', proposalIds).order('created_at', { ascending: true })
        : { data: [] }
      setMessages(msgs ?? [])
      await supabase.from('messages').update({ is_read: true })
        .in('proposal_id', proposalIds).eq('receiver_id', user.id).eq('is_read', false)
    } else {
      setOtherId(c.other_id)
      const { data: prof } = await supabase.from('profiles').select('name').eq('id', c.other_id).single()
      setOtherName(prof?.name ?? '인플루언서')

      const { data: msgs } = await supabase
        .from('messages')
        .select('*')
        .or(`and(sender_id.eq.${user.id},receiver_id.eq.${c.other_id}),and(sender_id.eq.${c.other_id},receiver_id.eq.${user.id})`)
        .order('created_at', { ascending: true })
      setMessages(msgs ?? [])
      const last = (msgs ?? [])[(msgs ?? []).length - 1]
      const propId = last?.proposal_id ?? null
      setSingleProposalId(propId)
      if (propId) {
        const { data: prop } = await supabase.from('proposals').select('proposed_date, start_at').eq('id', propId).single()
        setSingleProposalState(prop ? { proposedDate: prop.proposed_date, startAt: prop.start_at } : null)
      }
      await supabase.from('messages').update({ is_read: true })
        .eq('sender_id', c.other_id).eq('receiver_id', user.id).eq('is_read', false)
    }
    setLoading(false)
  }, [id, supabase])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight
    }
  }, [messages])

  useEffect(() => {
    if (!conv) return
    const channel = supabase
      .channel(`room-${id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const msg = payload.new as any
        const relevant = conv.kind === 'campaign'
          ? participants.some((p) => p.proposalId === msg.proposal_id)
          : (msg.sender_id === conv.other_id || msg.receiver_id === conv.other_id)
        if (relevant) setMessages((prev) => [...prev, msg])
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conv, participants])

  const perm = conv && currentUser
    ? checkConversationPermission({ currentUserId: currentUser.id, ownerId: conv.advertiser_id, managerId: conv.manager_id })
    : null

  const uploadFile = async (file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch('/api/chat/upload', { method: 'POST', body: fd })
    const j = await res.json()
    return res.ok ? (j as { url: string; name: string; type: string }) : null
  }

  const sendMessage = async () => {
    if (!newMessage.trim() || !currentUser || !conv) return
    if (conv.kind === 'campaign') {
      const res = await sendCampaignMessage({
        campaignId: conv.campaign_id,
        content: newMessage.trim(),
        onlyInfluencerId: targetedId,
      })
      if (!res.ok) return
    } else {
      await supabase.from('messages').insert({
        sender_id: currentUser.id,
        receiver_id: otherId,
        proposal_id: singleProposalId,
        content: newMessage.trim(),
      })
    }
    setNewMessage('')
    load()
  }

  const handleFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !currentUser || !conv) return
    setUploading(true)
    const uploaded = await uploadFile(file)
    if (uploaded) {
      if (conv.kind === 'campaign') {
        await sendCampaignMessage({
          campaignId: conv.campaign_id,
          content: '',
          onlyInfluencerId: targetedId,
          fileUrl: uploaded.url,
          fileName: uploaded.name,
          fileType: uploaded.type,
          checkpointKind: markAsGuide ? 'guide' : null,
        })
      } else {
        await supabase.from('messages').insert({
          sender_id: currentUser.id,
          receiver_id: otherId,
          proposal_id: singleProposalId,
          content: '',
          file_url: uploaded.url,
          file_name: uploaded.name,
          file_type: uploaded.type,
          checkpoint_kind: markAsGuide && singleProposalId ? 'guide' : null,
        })
      }
      load()
    }
    setUploading(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  const handleAcceptDate = async (proposalId: string) => {
    await acceptDateProposal(proposalId)
    load()
  }

  const pickTarget = (p: Participant) => setConfirmTargeted(p)
  const confirmTarget = () => {
    if (confirmTargeted) setTargetedId(confirmTargeted.influencerId)
    setConfirmTargeted(null)
  }

  if (loading) return <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">불러오는 중...</div>
  if (!conv) return <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">대화를 찾을 수 없어요.</div>

  const isCampaign = conv.kind === 'campaign'
  const nameByInfluencer = Object.fromEntries(participants.map((p) => [p.influencerId, p.name]))
  const proposalToInfluencer = Object.fromEntries(participants.map((p) => [p.proposalId, p.influencerId]))

  // D7 3-7 — proposal_id별 마지막 날짜제안 메시지만 live/accepted, 그 이전 것들은 answered
  const lastDateMsgIdByProposal: Record<string, string> = {}
  for (const m of messages) if (m.proposed_date) lastDateMsgIdByProposal[m.proposal_id] = m.id
  const dateStatusFor = (msg: any): 'live' | 'accepted' | 'answered' | null => {
    if (!msg.proposed_date) return null
    if (lastDateMsgIdByProposal[msg.proposal_id] !== msg.id) return 'answered'
    const state = isCampaign ? participants.find((p) => p.proposalId === msg.proposal_id) : singleProposalState
    if (!state) return 'live'
    const proposedDate = 'proposedDate' in state ? state.proposedDate : null
    const startAt = 'startAt' in state ? state.startAt : null
    if (proposedDate === msg.proposed_date) return 'live'
    if (startAt && startAt.slice(0, 10) === msg.proposed_date) return 'accepted'
    return 'answered'
  }

  // 신고: 캠페인 대화면 선택된 참여자의 proposalId, 개인 대화면 singleProposalId
  const reportProposalId = isCampaign ? (targetedId ? participants.find((p) => p.influencerId === targetedId)?.proposalId ?? null : null) : singleProposalId
  const canReport = isCampaign ? !!reportProposalId : !!singleProposalId

  return (
    <div className="flex flex-col [.adv-pc_&]:flex-row flex-1 min-h-0 [.adv-pc_&]:h-full">
     <div className="flex flex-col flex-1 min-w-0 min-h-0">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[#EAEAEE] [.adv-pc_&]:px-5">
        <Link href="/advertiser/messages" className="text-gray-400 hover:text-gray-600 [.adv-pc_&]:hidden">
          <ArrowLeft size={18} strokeWidth={1.75} />
        </Link>
        <div
          className={`w-9 h-9 flex items-center justify-center font-bold shrink-0 ${
            isCampaign ? 'rounded-[10px] bg-[#DBEAFE] text-[#1D4ED8]' : 'rounded-full bg-[#FEF3C7] text-[#B45309]'
          }`}
        >
          {isCampaign ? <Users size={18} strokeWidth={1.75} /> : initial(otherName)}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-gray-800 truncate">{isCampaign ? campaignTitle : otherName}</p>
            <span className={`text-[9.5px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${isCampaign ? 'bg-[#DBEAFE] text-[#1D4ED8]' : 'bg-[#FEF3C7] text-[#B45309]'}`}>
              {isCampaign ? `1:N 참여 ${participants.length}명` : '1:1'}
            </span>
          </div>
          {conv.manager_id && <p className="text-[11px] text-gray-400">담당 {managerName}</p>}
        </div>
        {/* D6 E4 — 신고 입구는 대화 헤더 한 곳. 캠페인 대화는 참여자를 먼저 고른다(D7 3-5) */}
        <button
          onClick={() => (canReport ? setReportOpen(true) : undefined)}
          className={`ml-auto text-[11px] shrink-0 ${canReport ? 'text-gray-400 hover:text-red-500' : 'text-gray-300 cursor-not-allowed'}`}
          title={isCampaign && !canReport ? '먼저 참여자를 선택해주세요' : undefined}
        >
          문제 신고
        </button>
      </div>

      {isCampaign && (
        <div className="flex gap-1.5 overflow-x-auto px-4 pt-2 [.adv-pc_&]:px-5">
          {participants.map((p) => (
            <button
              key={p.influencerId}
              onClick={() => pickTarget(p)}
              className={`flex items-center gap-1 shrink-0 pl-1 pr-2.5 py-1 rounded-full border text-[11.5px] font-medium transition ${
                targetedId === p.influencerId ? 'bg-[#1D4ED8] text-white border-[#1D4ED8]' : 'bg-white text-[#5C5C68] border-[#EAEAEE] hover:border-[#C4C4CE]'
              }`}
            >
              <span className="w-[22px] h-[22px] rounded-full bg-[#FEF3C7] text-[#B45309] text-[10px] font-bold flex items-center justify-center">
                {initial(p.name)}
              </span>
              {p.name}
            </button>
          ))}
        </div>
      )}

      {targetedId && (
        <div className="mx-4 mt-2 [.adv-pc_&]:mx-5 bg-[#EFF6FF] border border-[#DBEAFE] rounded-xl px-3 py-2 flex items-center justify-between">
          <p className="text-[12px] text-[#1D4ED8] font-medium">
            {nameByInfluencer[targetedId]}님에게만 보냅니다 — 다른 참여자에게는 가지 않아요
          </p>
          <button onClick={() => setTargetedId(null)} className="text-[11px] font-semibold text-[#1D4ED8] underline shrink-0 ml-2">
            전체로 되돌리기
          </button>
        </div>
      )}

      {/* D10 §1 — 모바일에서는 대화창 상단 인라인, PC에서는 우측 aside(아래)로 이동 */}
      {!isCampaign && singleProposalId && currentUser && (
        <div className="px-4 pt-2 [.adv-pc_&]:hidden">
          <DealConfirmBar proposalId={singleProposalId} currentUserId={currentUser.id} onPrefill={setNewMessage} />
        </div>
      )}

      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto space-y-3 px-4 py-4 [.adv-pc_&]:px-5">
        {messages.length === 0 && (
          <p className="text-center text-gray-400 text-sm py-8">아직 대시가 없어요. 먼저 인사해보세요!</p>
        )}
        {messages.map((msg) => {
          const senderInfluencerId = isCampaign ? proposalToInfluencer[msg.proposal_id] : null
          const isMine = msg.sender_id === currentUser?.id
          return (
            <MessageBubble
              key={msg.id}
              msg={msg}
              isMine={isMine}
              showSenderName={isCampaign}
              senderName={senderInfluencerId ? nameByInfluencer[senderInfluencerId] : otherName}
              targetedName={msg.targeted_only ? nameByInfluencer[msg.receiver_id] ?? otherName : null}
              dateProposalStatus={dateStatusFor(msg)}
              canAcceptDate={!isMine}
              onAcceptDate={() => handleAcceptDate(msg.proposal_id)}
            />
          )
        })}
      </div>

      <div className="px-4 pb-4 [.adv-pc_&]:px-5">
        {singleProposalId || isCampaign ? (
          <label className="flex items-center gap-1.5 text-[11px] text-gray-500 mb-1.5">
            <input type="checkbox" checked={markAsGuide} onChange={(e) => setMarkAsGuide(e.target.checked)} className="w-3 h-3 accent-amber-500" />
            다음 파일을 가이드로 등록(딜시트 가이드 단계 자동 완료)
          </label>
        ) : null}

        {perm && !perm.canSend && (
          <p className="text-[11px] text-red-500 mb-1.5">담당자만 이 대화에 보낼 수 있어요.</p>
        )}
        {perm?.actingAsProxy && (
          <p className="text-[11px] text-[#92400E] bg-[#FEF3C7] rounded-lg px-2.5 py-1.5 mb-1.5">
            {managerName} 담당 대화예요. 대표로 보내면 「회사 대표 대리 발송」으로 표시됩니다.
          </p>
        )}

        <div className="flex gap-2">
          <input ref={fileRef} type="file" onChange={handleFile} className="hidden"
            accept=".pdf,.doc,.docx,.hwp,.hwpx,.ppt,.pptx,.xls,.xlsx,.jpg,.jpeg,.png,.zip" />
          <button onClick={() => fileRef.current?.click()} disabled={uploading}
            className="px-3 py-2.5 rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-50" title="파일 첨부">
            {uploading ? <Loader2 size={16} className="animate-spin" /> : <Paperclip size={16} strokeWidth={1.75} />}
          </button>
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
            disabled={perm ? !perm.canSend : false}
            className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 disabled:bg-gray-50"
            placeholder="대시에 쓸 말을 입력하세요"
          />
          <button
            onClick={sendMessage}
            disabled={perm ? !perm.canSend : false}
            className="bg-[#F59E0B] text-white px-4 py-2.5 rounded-xl hover:bg-[#D97706] transition disabled:opacity-50"
          >
            전송
          </button>
        </div>
      </div>

      {confirmTargeted && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[rgba(17,17,21,0.42)] px-4" onClick={() => setConfirmTargeted(null)}>
          <div className="bg-white rounded-2xl w-full max-w-[380px] p-5" onClick={(e) => e.stopPropagation()}>
            <p className="text-base font-bold text-[#17171B]">{confirmTargeted.name}님에게만 보낼까요?</p>
            <p className="text-[12px] text-[#7C7C88] mt-2 leading-relaxed">
              캠페인 참여자 전체가 아니라 {confirmTargeted.name}님에게만 전달됩니다. 다른 참여자는 이 내용을 볼 수 없어요.
            </p>
            <p className="text-[11px] text-[#9A9AA5] mt-1.5">조건이 한 사람만 달라지면 딜시트도 그 사람만 바뀝니다.</p>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setConfirmTargeted(null)} className="flex-1 py-2.5 rounded-xl border border-[#EAEAEE] text-sm text-[#7C7C88] hover:bg-[#F6F6F7]">
                취소
              </button>
              <button onClick={confirmTarget} className="flex-1 py-2.5 rounded-xl bg-[#1D4ED8] text-white font-bold text-sm hover:bg-[#1E40AF]">
                확인
              </button>
            </div>
          </div>
        </div>
      )}

      {reportOpen && reportProposalId && (
        <ReportModal proposalId={reportProposalId} role="advertiser" onClose={() => setReportOpen(false)} onDone={() => setReportOpen(false)} />
      )}
     </div>

      {/* D10 §1 — PC 우측 열(288px): 협의 조건 요약 + 확정 바. 모바일에는 없음(위 인라인 유지) */}
      <aside className="hidden [.adv-pc_&]:flex [.adv-pc_&]:flex-col [.adv-pc_&]:w-[288px] [.adv-pc_&]:shrink-0 [.adv-pc_&]:border-l [.adv-pc_&]:border-[#EAEAEE] [.adv-pc_&]:overflow-y-auto [.adv-pc_&]:p-4">
        {reportProposalId && currentUser ? (
          <DealConfirmBar proposalId={reportProposalId} currentUserId={currentUser.id} onPrefill={setNewMessage} />
        ) : (
          <p className="text-[12px] text-[#9A9AA5] leading-relaxed">
            {isCampaign ? '참여자를 선택하면 협의 조건이 여기 표시돼요.' : '협의를 시작하면 확정 바가 여기 표시돼요.'}
          </p>
        )}
      </aside>
    </div>
  )
}
