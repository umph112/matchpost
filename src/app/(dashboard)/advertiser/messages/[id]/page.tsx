'use client'

import { useState, useEffect, useRef, useCallback, type ChangeEvent } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import DealConfirmBar from '@/components/DealConfirmBar'
import MessageBubble from '@/components/messages/MessageBubble'
import ReportModal from '@/components/ReportModal'
import { initial } from '@/lib/initial'
import { acceptDateProposal } from '@/lib/deals/time'
import { sendCampaignMessage } from '@/lib/deals/campaignMessage'
import { checkConversationPermission } from '@/lib/permissions'

type Participant = { influencerId: string; name: string; proposalId: string; confirmed: boolean }

export default function AdvertiserMessageRoomPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const supabase = createClient()

  const [currentUser, setCurrentUser] = useState<any>(null)
  const [conv, setConv] = useState<any>(null)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [otherName, setOtherName] = useState('')
  const [otherId, setOtherId] = useState<string | null>(null)
  const [singleProposalId, setSingleProposalId] = useState<string | null>(null)
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

    if (c.kind === 'campaign') {
      const { data: props } = await supabase
        .from('proposals')
        .select('id, influencer_id, advertiser_confirmed, influencer_confirmed')
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
      setSingleProposalId(last?.proposal_id ?? null)
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
    if (!file || !currentUser || !conv || conv.kind === 'campaign') return
    setUploading(true)
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch('/api/chat/upload', { method: 'POST', body: fd })
    const j = await res.json()
    if (res.ok) {
      await supabase.from('messages').insert({
        sender_id: currentUser.id,
        receiver_id: otherId,
        proposal_id: singleProposalId,
        content: '',
        file_url: j.url,
        file_name: j.name,
        file_type: j.type,
        checkpoint_kind: markAsGuide && singleProposalId ? 'guide' : null,
      })
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

  if (loading) return <div className="max-w-lg mx-auto px-4 py-16 text-center text-gray-400">불러오는 중...</div>
  if (!conv) return <div className="max-w-lg mx-auto px-4 py-16 text-center text-gray-400">대화를 찾을 수 없어요.</div>

  const isCampaign = conv.kind === 'campaign'
  const nameByInfluencer = Object.fromEntries(participants.map((p) => [p.influencerId, p.name]))
  const proposalToInfluencer = Object.fromEntries(participants.map((p) => [p.proposalId, p.influencerId]))
  const managerName = conv.manager_id
    ? (conv.manager_id === conv.advertiser_id ? '나' : (nameByInfluencer[conv.manager_id] ?? '담당자'))
    : null

  return (
    <div className="max-w-lg mx-auto px-4 py-8 flex flex-col h-screen">
      <div className="flex items-center mb-3">
        <Link href="/advertiser/messages" className="mr-4 text-gray-400 hover:text-gray-600">← 뒤로</Link>
        <div
          className={`w-9 h-9 flex items-center justify-center font-bold mr-3 shrink-0 ${
            isCampaign ? 'rounded-[10px] bg-[#DBEAFE] text-[#1D4ED8]' : 'rounded-full bg-[#FEF3C7] text-[#B45309]'
          }`}
        >
          {isCampaign ? '👥' : initial(otherName)}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-gray-800 truncate">{isCampaign ? '캠페인 대화' : otherName}</p>
            <span className={`text-[9.5px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${isCampaign ? 'bg-[#DBEAFE] text-[#1D4ED8]' : 'bg-[#FEF3C7] text-[#B45309]'}`}>
              {isCampaign ? `1:N 참여 ${participants.length}명` : '1:1'}
            </span>
          </div>
          {conv.manager_id && <p className="text-[11px] text-gray-400">담당 {managerName}</p>}
        </div>
        {/* D6 E4 — 신고 입구는 대화 헤더 한 곳뿐(개인 대화 기준 — 캠페인 대화는 참여자를 먼저 선택) */}
        {!isCampaign && singleProposalId && (
          <button onClick={() => setReportOpen(true)} className="ml-auto text-[11px] text-gray-400 hover:text-red-500">
            문제 신고
          </button>
        )}
      </div>

      {isCampaign && (
        <div className="flex gap-1.5 overflow-x-auto pb-2 mb-2">
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
        <div className="bg-[#EFF6FF] border border-[#DBEAFE] rounded-xl px-3 py-2 mb-2 flex items-center justify-between">
          <p className="text-[12px] text-[#1D4ED8] font-medium">
            {nameByInfluencer[targetedId]}님에게만 보냅니다 — 다른 참여자에게는 가지 않아요
          </p>
          <button onClick={() => setTargetedId(null)} className="text-[11px] font-semibold text-[#1D4ED8] underline shrink-0 ml-2">
            전체로 되돌리기
          </button>
        </div>
      )}

      {!isCampaign && singleProposalId && currentUser && (
        <DealConfirmBar proposalId={singleProposalId} currentUserId={currentUser.id} onPrefill={setNewMessage} />
      )}

      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto space-y-3 mb-4">
        {messages.length === 0 && (
          <p className="text-center text-gray-400 text-sm py-8">아직 메시지가 없어요. 먼저 인사해보세요!</p>
        )}
        {messages.map((msg) => {
          const senderInfluencerId = isCampaign ? proposalToInfluencer[msg.proposal_id] : null
          const isMine = msg.sender_id === currentUser?.id
          let dateStatus: 'live' | 'accepted' | 'answered' | null = null
          if (msg.proposed_date) {
            const prop = participants.find((p) => p.proposalId === msg.proposal_id)
            dateStatus = 'live'
          }
          return (
            <MessageBubble
              key={msg.id}
              msg={msg}
              isMine={isMine}
              showSenderName={isCampaign}
              senderName={senderInfluencerId ? nameByInfluencer[senderInfluencerId] : otherName}
              targetedName={msg.targeted_only ? nameByInfluencer[msg.receiver_id] ?? otherName : null}
              dateProposalStatus={msg.proposed_date ? 'live' : null}
              canAcceptDate={!isMine}
              onAcceptDate={() => handleAcceptDate(msg.proposal_id)}
            />
          )
        })}
      </div>

      {!isCampaign && singleProposalId && (
        <label className="flex items-center gap-1.5 text-[11px] text-gray-500 mb-1.5">
          <input type="checkbox" checked={markAsGuide} onChange={(e) => setMarkAsGuide(e.target.checked)} className="w-3 h-3 accent-amber-500" />
          다음 파일을 가이드로 등록(딜시트 가이드 단계 자동 완료)
        </label>
      )}

      {perm && !perm.canSend && (
        <p className="text-[11px] text-red-500 mb-1.5">담당자만 이 대화에 메시지를 보낼 수 있어요.</p>
      )}
      {perm?.actingAsProxy && (
        <p className="text-[11px] text-[#92400E] bg-[#FEF3C7] rounded-lg px-2.5 py-1.5 mb-1.5">
          {managerName} 담당 대화예요. 대표로 보내면 「회사 대표 대리 발송」으로 표시됩니다.
        </p>
      )}

      <div className="flex gap-2">
        {!isCampaign && (
          <>
            <input ref={fileRef} type="file" onChange={handleFile} className="hidden"
              accept=".pdf,.doc,.docx,.hwp,.hwpx,.ppt,.pptx,.xls,.xlsx,.jpg,.jpeg,.png,.zip" />
            <button onClick={() => fileRef.current?.click()} disabled={uploading}
              className="px-3 py-2.5 rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-50" title="파일 첨부">
              {uploading ? '⏳' : '📎'}
            </button>
          </>
        )}
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
          disabled={perm ? !perm.canSend : false}
          className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 disabled:bg-gray-50"
          placeholder="메시지 입력..."
        />
        <button
          onClick={sendMessage}
          disabled={perm ? !perm.canSend : false}
          className="bg-[#F59E0B] text-white px-4 py-2.5 rounded-xl hover:bg-[#D97706] transition disabled:opacity-50"
        >
          전송
        </button>
      </div>

      {confirmTargeted && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={() => setConfirmTargeted(null)}>
          <div className="bg-white rounded-2xl w-full max-w-[380px] p-5" onClick={(e) => e.stopPropagation()}>
            <p className="text-base font-bold text-[#17171B]">{confirmTargeted.name}님에게만 보낼까요?</p>
            <p className="text-[12px] text-[#7C7C88] mt-2 leading-relaxed">
              캠페인 참여자 전체가 아니라 {confirmTargeted.name}님에게만 메시지가 전달됩니다. 다른 참여자는 이 내용을 볼 수 없어요.
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

      {reportOpen && singleProposalId && (
        <ReportModal proposalId={singleProposalId} role="advertiser" onClose={() => setReportOpen(false)} onDone={() => setReportOpen(false)} />
      )}
    </div>
  )
}
