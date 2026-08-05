'use client'

import { useState, useEffect, useRef, type ChangeEvent } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import DealConfirmBar from '@/components/DealConfirmBar'
import MatchScore from '@/components/MatchScore'
import { initial } from '@/lib/initial'

export default function AdvertiserMessagesPage() {
  const [conversations, setConversations] = useState<any[]>([])
  const [selectedConversation, setSelectedConversation] = useState<any>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [markAsGuide, setMarkAsGuide] = useState(true)
  const supabase = createClient()
  const searchParams = useSearchParams()
  const toParam = searchParams.get('to')
  const dateParam = searchParams.get('date')

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setCurrentUser(user)
      const convList = await fetchConversations(user.id)

      // ?to= 파라미터: 해당 인플루언서 대화 자동 선택
      if (toParam) {
        const existing = convList.find((c: any) => c.otherId === toParam)
        if (existing) {
          setSelectedConversation(existing)
          fetchMessages(existing.otherId, existing.proposalId)
        } else {
          // 기존 대화 없음 → 이름 조회 후 신규 대화창 열기
          const { data: prof } = await supabase.from('profiles').select('name').eq('id', toParam).single()
          setSelectedConversation({ otherId: toParam, otherName: prof?.name ?? '인플루언서', proposalId: null })
          setMessages([])
        }
        // ?date= 있으면 입력창 프리필
        if (dateParam) {
          const [, m, d] = dateParam.split('-')
          setNewMessage(`안녕하세요! ${m}월 ${d}일 날짜로 협업을 제안드리고 싶어요.\n캠페인 관련 이야기 나눠볼 수 있을까요?`)
        }
      }
    }
    init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight
    }
  }, [messages])

  const fetchConversations = async (userId: string) => {
    const { data } = await supabase
      .from('messages')
      .select('*, profiles!sender_id(name), proposals(collaboration_type)')
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
      .order('created_at', { ascending: false })

    const grouped: Record<string, any> = {}
    data?.forEach((msg) => {
      const otherId = msg.sender_id === userId ? msg.receiver_id : msg.sender_id
      if (!grouped[otherId]) {
        grouped[otherId] = {
          otherId,
          lastMessage: msg,
          proposalId: msg.proposal_id,
        }
      }
    })

    const convList = await Promise.all(
      Object.values(grouped).map(async (conv) => {
        const [{ data: profile }, { data: ip }] = await Promise.all([
          supabase.from('profiles').select('name').eq('id', conv.otherId).single(),
          supabase.from('influencer_profiles').select('match_score, review_count').eq('user_id', conv.otherId).single(),
        ])
        return { ...conv, otherName: profile?.name, matchScore: ip?.match_score ?? null, reviewCount: ip?.review_count ?? 0 }
      })
    )

    setConversations(convList)
    setLoading(false)
    return convList
  }

  const fetchMessages = async (otherId: string, proposalId: string) => {
    if (!currentUser) return

    const { data } = await supabase
      .from('messages')
      .select('*')
      .or(
        `and(sender_id.eq.${currentUser.id},receiver_id.eq.${otherId}),and(sender_id.eq.${otherId},receiver_id.eq.${currentUser.id})`
      )
      .order('created_at', { ascending: true })

    setMessages(data ?? [])

    const channel = supabase
      .channel(`messages-${currentUser.id}-${otherId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
      }, (payload) => {
        const msg = payload.new as any
        if (
          (msg.sender_id === currentUser.id && msg.receiver_id === otherId) ||
          (msg.sender_id === otherId && msg.receiver_id === currentUser.id)
        ) {
          setMessages(prev => [...prev, msg])
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }

  const selectConversation = (conv: any) => {
    setSelectedConversation(conv)
    fetchMessages(conv.otherId, conv.proposalId)
  }

  const sendMessage = async () => {
    if (!newMessage.trim() || !currentUser || !selectedConversation) return

    await supabase.from('messages').insert({
      sender_id: currentUser.id,
      receiver_id: selectedConversation.otherId,
      proposal_id: selectedConversation.proposalId,
      content: newMessage.trim(),
    })

    setNewMessage('')

  }

  const handleFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !currentUser || !selectedConversation) return
    setUploading(true)
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch('/api/chat/upload', { method: 'POST', body: fd })
    const j = await res.json()
    if (res.ok) {
      await supabase.from('messages').insert({
        sender_id: currentUser.id,
        receiver_id: selectedConversation.otherId,
        proposal_id: selectedConversation.proposalId,
        content: '',
        file_url: j.url,
        file_name: j.name,
        file_type: j.type,
        checkpoint_kind: markAsGuide && selectedConversation.proposalId ? 'guide' : null,
      })
    }
    setUploading(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  if (selectedConversation) {
    return (
      <div className="max-w-lg mx-auto px-4 py-8 flex flex-col h-screen">
        <div className="flex items-center mb-4">
          <button onClick={() => setSelectedConversation(null)} className="mr-4 text-gray-400 hover:text-gray-600">
            ← 뒤로
          </button>
          <div className="w-9 h-9 bg-[#FEF3C7] rounded-full flex items-center justify-center text-[#B45309] font-bold mr-3">
            {initial(selectedConversation.otherName)}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="font-semibold text-gray-800">{selectedConversation.otherName}</p>
              <MatchScore score={selectedConversation.matchScore ?? null} reviewCount={selectedConversation.reviewCount ?? 0} />
            </div>
          </div>
        </div>

        {selectedConversation.proposalId && currentUser && (
          <DealConfirmBar proposalId={selectedConversation.proposalId} currentUserId={currentUser.id} />
        )}

        <div ref={messagesContainerRef} className="flex-1 overflow-y-auto space-y-3 mb-4">
          {messages.length === 0 && (
            <p className="text-center text-gray-400 text-sm py-8">아직 메시지가 없어요. 먼저 인사해보세요!</p>
          )}
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.sender_id === currentUser?.id ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`max-w-xs px-4 py-2.5 rounded-2xl text-sm ${
                msg.sender_id === currentUser?.id
                  ? 'bg-[#17171B] text-white rounded-br-sm'
                  : 'bg-gray-100 text-gray-800 rounded-bl-sm'
              }`}>
                {msg.file_url && (
                  <a href={msg.file_url} target="_blank" rel="noopener noreferrer" download={msg.file_name}
                    className={`flex items-center gap-1.5 mb-1 underline ${msg.sender_id === currentUser?.id ? 'text-white/70' : 'text-[#B45309]'}`}>
                    📎 <span className="truncate max-w-[180px]">{msg.file_name}</span>
                  </a>
                )}
                {msg.content}
                <p className={`text-xs mt-1 ${msg.sender_id === currentUser?.id ? 'text-white/50' : 'text-gray-400'}`}>
                  {new Date(msg.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {selectedConversation.proposalId && (
          <label className="flex items-center gap-1.5 text-[11px] text-gray-500 mb-1.5">
            <input type="checkbox" checked={markAsGuide} onChange={(e) => setMarkAsGuide(e.target.checked)}
              className="w-3 h-3 accent-amber-500" />
            다음 파일을 가이드로 등록(딜시트 가이드 단계 자동 완료)
          </label>
        )}
        <div className="flex gap-2">
          <input ref={fileRef} type="file" onChange={handleFile} className="hidden"
            accept=".pdf,.doc,.docx,.hwp,.hwpx,.ppt,.pptx,.xls,.xlsx,.jpg,.jpeg,.png,.zip" />
          <button onClick={() => fileRef.current?.click()} disabled={uploading}
            className="px-3 py-2.5 rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-50" title="파일 첨부">
            {uploading ? '⏳' : '📎'}
          </button>
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
            className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            placeholder="메시지 입력..."
          />
          <button
            onClick={sendMessage}
            className="bg-[#F59E0B] text-white px-4 py-2.5 rounded-xl hover:bg-[#D97706] transition"
          >
            전송
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      <div className="flex items-center mb-8">
        <Link href="/advertiser/dashboard" className="mr-4 text-gray-400 hover:text-gray-600">
          ← 뒤로
        </Link>
        <h1 className="text-xl font-bold text-gray-900">대화</h1>
      </div>

      {loading && <p className="text-center text-gray-400 py-16">불러오는 중...</p>}

      {!loading && conversations.length === 0 && (
        <div className="text-center py-16">
          <div className="text-5xl mb-4">💬</div>
          <p className="text-gray-500">아직 대화가 없어요</p>
        </div>
      )}

      {conversations.map((conv) => (
        <button
          key={conv.otherId}
          onClick={() => selectConversation(conv)}
          className="w-full bg-white rounded-2xl p-4 shadow-sm mb-3 flex items-center hover:shadow-md transition text-left"
        >
          <div className="w-11 h-11 bg-[#FEF3C7] rounded-full flex items-center justify-center text-[#B45309] font-bold mr-3">
            {initial(conv.otherName)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-semibold text-gray-800">{conv.otherName}</p>
              <MatchScore score={conv.matchScore} reviewCount={conv.reviewCount} />
            </div>
            <p className="text-sm text-gray-400 truncate">{conv.lastMessage?.content}</p>
          </div>
          <p className="text-xs text-gray-300 ml-2">
            {new Date(conv.lastMessage?.created_at).toLocaleDateString('ko-KR')}
          </p>
        </button>
      ))}
    </div>
  )
}