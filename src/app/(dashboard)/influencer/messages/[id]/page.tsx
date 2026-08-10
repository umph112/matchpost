'use client'

import { useState, useEffect, useRef, useCallback, type ChangeEvent } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { ArrowLeft, Paperclip, Loader2 } from 'lucide-react'
import DealConfirmBar from '@/components/DealConfirmBar'
import MessageBubble from '@/components/messages/MessageBubble'
import ReportModal from '@/components/ReportModal'
import { initial } from '@/lib/initial'
import { acceptDateProposal } from '@/lib/deals/time'

export default function InfluencerMessageRoomPage() {
  const params = useParams()
  const id = params.id as string
  const supabase = createClient()

  const [currentUser, setCurrentUser] = useState<any>(null)
  const [advertiserId, setAdvertiserId] = useState<string | null>(null)
  const [advertiserName, setAdvertiserName] = useState('')
  const [proposalId, setProposalId] = useState<string | null>(null)
  const [proposalState, setProposalState] = useState<{ proposedDate: string | null; startAt: string | null } | null>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [checkpointKind, setCheckpointKind] = useState<'draft' | 'publish' | ''>('draft')
  const [reportOpen, setReportOpen] = useState(false)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setCurrentUser(user)

    const { data: conv } = await supabase.from('conversations').select('*').eq('id', id).single()
    if (!conv) { setLoading(false); return }
    setAdvertiserId(conv.advertiser_id)

    const { data: prof } = await supabase.from('profiles').select('name').eq('id', conv.advertiser_id).single()
    setAdvertiserName(prof?.name ?? '광고주')

    const { data: msgs } = await supabase
      .from('messages')
      .select('*')
      .or(`and(sender_id.eq.${user.id},receiver_id.eq.${conv.advertiser_id}),and(sender_id.eq.${conv.advertiser_id},receiver_id.eq.${user.id})`)
      .order('created_at', { ascending: true })
    setMessages(msgs ?? [])
    const last = (msgs ?? [])[(msgs ?? []).length - 1]
    const pid = last?.proposal_id ?? null
    setProposalId(pid)
    if (pid) {
      const { data: prop } = await supabase.from('proposals').select('proposed_date, start_at').eq('id', pid).single()
      setProposalState(prop ? { proposedDate: prop.proposed_date, startAt: prop.start_at } : null)
    }

    await supabase.from('messages').update({ is_read: true })
      .eq('sender_id', conv.advertiser_id).eq('receiver_id', user.id).eq('is_read', false)
    setLoading(false)
  }, [id, supabase])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight
    }
  }, [messages])

  useEffect(() => {
    if (!advertiserId || !currentUser) return
    const channel = supabase
      .channel(`inf-room-${id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const msg = payload.new as any
        if (
          (msg.sender_id === currentUser.id && msg.receiver_id === advertiserId) ||
          (msg.sender_id === advertiserId && msg.receiver_id === currentUser.id)
        ) {
          setMessages((prev) => [...prev, msg])
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [advertiserId, currentUser])

  const sendMessage = async () => {
    if (!newMessage.trim() || !currentUser || !advertiserId) return
    await supabase.from('messages').insert({
      sender_id: currentUser.id, receiver_id: advertiserId, proposal_id: proposalId, content: newMessage.trim(),
    })
    setNewMessage('')
  }

  const handleFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !currentUser || !advertiserId) return
    setUploading(true)
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch('/api/chat/upload', { method: 'POST', body: fd })
    const j = await res.json()
    if (res.ok) {
      await supabase.from('messages').insert({
        sender_id: currentUser.id, receiver_id: advertiserId, proposal_id: proposalId,
        content: '', file_url: j.url, file_name: j.name, file_type: j.type,
        checkpoint_kind: proposalId && checkpointKind ? checkpointKind : null,
      })
    }
    setUploading(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  const handleAcceptDate = async (pid: string) => {
    await acceptDateProposal(pid)
    load()
  }

  if (loading) return <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">불러오는 중...</div>
  if (!advertiserId) return <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">대화를 찾을 수 없어요.</div>

  // D7 3-7 — 마지막 날짜제안 메시지만 live/accepted, 그 이전 것은 answered
  const lastDateMsgId = [...messages].reverse().find((m) => m.proposed_date)?.id ?? null
  const dateStatusFor = (msg: any): 'live' | 'accepted' | 'answered' | null => {
    if (!msg.proposed_date) return null
    if (msg.id !== lastDateMsgId) return 'answered'
    if (!proposalState) return 'live'
    if (proposalState.proposedDate === msg.proposed_date) return 'live'
    if (proposalState.startAt && proposalState.startAt.slice(0, 10) === msg.proposed_date) return 'accepted'
    return 'answered'
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 [.inf-pc_&]:h-full">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[#EAEAEE] [.inf-pc_&]:px-5">
        <Link href="/influencer/messages" className="text-gray-400 hover:text-gray-600 [.inf-pc_&]:hidden">
          <ArrowLeft size={18} strokeWidth={1.75} />
        </Link>
        <div className="w-9 h-9 bg-[#FEF3C7] rounded-full flex items-center justify-center text-[#B45309] font-bold shrink-0">
          {initial(advertiserName)}
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-gray-800 truncate">{advertiserName}</p>
          <p className="text-[11px] text-gray-400">광고주와 나만 볼 수 있어요</p>
        </div>
        {/* D6 E4 — 신고 입구는 대화 헤더 한 곳뿐 */}
        {proposalId && (
          <button onClick={() => setReportOpen(true)} className="ml-auto text-[11px] text-gray-400 hover:text-red-500 shrink-0">
            문제 신고
          </button>
        )}
      </div>

      {proposalId && currentUser && (
        <div className="px-4 pt-2 [.inf-pc_&]:px-5">
          <DealConfirmBar proposalId={proposalId} currentUserId={currentUser.id} onPrefill={setNewMessage} />
        </div>
      )}

      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto space-y-3 px-4 py-4 [.inf-pc_&]:px-5">
        {messages.length === 0 && (
          <p className="text-center text-gray-400 text-sm py-8">아직 대시가 없어요. 먼저 인사해보세요!</p>
        )}
        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            msg={msg}
            isMine={msg.sender_id === currentUser?.id}
            groupSentBadge={!!msg.broadcast_id && msg.sender_id !== currentUser?.id}
            dateProposalStatus={dateStatusFor(msg)}
            canAcceptDate={msg.sender_id !== currentUser?.id}
            onAcceptDate={() => handleAcceptDate(msg.proposal_id)}
          />
        ))}
      </div>

      <div className="px-4 pb-4 [.inf-pc_&]:px-5">
        {proposalId && (
          <div className="flex items-center gap-2 text-[11px] text-gray-500 mb-1.5">
            <span>다음 파일을 등록:</span>
            {([['draft', '원고'], ['publish', '게재'], ['', '체크포인트 아님']] as const).map(([v, label]) => (
              <label key={v} className="flex items-center gap-1">
                <input type="radio" name="checkpointKind" checked={checkpointKind === v}
                  onChange={() => setCheckpointKind(v)} className="w-3 h-3 accent-amber-500" />
                {label}
              </label>
            ))}
          </div>
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
            className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            placeholder="대시에 쓸 말을 입력하세요"
          />
          <button onClick={sendMessage} className="bg-[#F59E0B] text-white px-4 py-2.5 rounded-xl hover:bg-[#D97706] transition">
            전송
          </button>
        </div>
      </div>

      {reportOpen && proposalId && (
        <ReportModal proposalId={proposalId} role="influencer" onClose={() => setReportOpen(false)} onDone={() => setReportOpen(false)} />
      )}
    </div>
  )
}
