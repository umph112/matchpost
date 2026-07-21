'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import DealConfirmBar from '@/components/DealConfirmBar'

function MessagesContent() {
  const [conversations, setConversations] = useState<any[]>([])
  const [selectedConversation, setSelectedConversation] = useState<any>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const searchParams = useSearchParams()
  const proposalId = searchParams.get('proposalId')
  const receiverId = searchParams.get('receiverId')
  const supabase = createClient()

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setCurrentUser(user)
      await fetchConversations(user.id)

      // URL 파라미터로 바로 대화 시작
      if (receiverId) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('name')
          .eq('id', receiverId)
          .single()

        const conv = {
          otherId: receiverId,
          otherName: profile?.name,
          proposalId: proposalId,
          lastMessage: null,
        }
        setSelectedConversation(conv)
        fetchMessages(user.id, receiverId)
      }
    }
    init()
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const fetchConversations = async (userId: string) => {
    const { data } = await supabase
      .from('messages')
      .select('*')
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
        const { data: profile } = await supabase
          .from('profiles')
          .select('name')
          .eq('id', conv.otherId)
          .single()
        return { ...conv, otherName: profile?.name }
      })
    )

    setConversations(convList)
    setLoading(false)
  }

  const fetchMessages = async (userId: string, otherId: string) => {
    const { data } = await supabase
      .from('messages')
      .select('*')
      .or(
        `and(sender_id.eq.${userId},receiver_id.eq.${otherId}),and(sender_id.eq.${otherId},receiver_id.eq.${userId})`
      )
      .order('created_at', { ascending: true })

    setMessages(data ?? [])

    const channel = supabase
      .channel(`messages-${userId}-${otherId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
      }, (payload) => {
        const msg = payload.new as any
        if (
          (msg.sender_id === userId && msg.receiver_id === otherId) ||
          (msg.sender_id === otherId && msg.receiver_id === userId)
        ) {
          setMessages(prev => [...prev, msg])
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }

  const selectConversation = (conv: any) => {
    setSelectedConversation(conv)
    if (currentUser) fetchMessages(currentUser.id, conv.otherId)
  }

  const sendMessage = async () => {
    if (!newMessage.trim() || !currentUser || !selectedConversation) return

    await supabase.from('messages').insert({
      sender_id: currentUser.id,
      receiver_id: selectedConversation.otherId,
      proposal_id: selectedConversation.proposalId ?? proposalId,
      content: newMessage.trim(),
    })

    setNewMessage('')
    
  }

  if (selectedConversation) {
    return (
      <div className="max-w-lg mx-auto px-4 py-8 flex flex-col h-screen">
        <div className="flex items-center mb-4">
          <button onClick={() => setSelectedConversation(null)} className="mr-4 text-gray-400 hover:text-gray-600">
            ← 뒤로
          </button>
          <div className="w-9 h-9 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold mr-3">
            {selectedConversation.otherName?.[0] ?? '?'}
          </div>
          <p className="font-semibold text-gray-800">{selectedConversation.otherName}</p>
        </div>

        {(selectedConversation.proposalId ?? proposalId) && currentUser && (
          <DealConfirmBar
            proposalId={selectedConversation.proposalId ?? proposalId}
            currentUserId={currentUser.id}
          />
        )}

        <div className="flex-1 overflow-y-auto space-y-3 mb-4">
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
                  ? 'bg-blue-600 text-white rounded-br-sm'
                  : 'bg-gray-100 text-gray-800 rounded-bl-sm'
              }`}>
                {msg.content}
                <p className={`text-xs mt-1 ${msg.sender_id === currentUser?.id ? 'text-blue-200' : 'text-gray-400'}`}>
                  {new Date(msg.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
            className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="메시지 입력..."
          />
          <button
            onClick={sendMessage}
            className="bg-blue-600 text-white px-4 py-2.5 rounded-xl hover:bg-blue-700 transition"
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
        <Link href="/influencer/dashboard" className="mr-4 text-gray-400 hover:text-gray-600">
          ← 뒤로
        </Link>
        <h1 className="text-xl font-bold text-gray-900">메시지</h1>
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
          <div className="w-11 h-11 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold mr-3">
            {conv.otherName?.[0] ?? '?'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-800">{conv.otherName}</p>
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

export default function InfluencerMessagesPage() {
  return (
    <Suspense>
      <MessagesContent />
    </Suspense>
  )
}