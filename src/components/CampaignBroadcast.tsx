'use client'

import { useState, useRef, type ChangeEvent } from 'react'
import { createClient } from '@/lib/supabase/client'

type P = { influencerId: string; name: string; proposalId: string; confirmed?: boolean }

// 광고주 → 참여 인플루언서 발송. 1명만 선택하면 1:1, 여러 명 선택하면 일괄(같은 내용/파일).
// 기본 선택은 '확정'된 인플루언서. 페이 조건이 다르면 개별 선택해서 따로 보낼 수 있음.
export default function CampaignBroadcast({
  senderId,
  participants,
}: {
  senderId: string
  participants: P[]
}) {
  const anyConfirmed = participants.some((p) => p.confirmed)
  const [selected, setSelected] = useState<Set<string>>(
    new Set(participants.filter((p) => (anyConfirmed ? p.confirmed : true)).map((p) => p.influencerId))
  )
  const [text, setText] = useState('')
  const [file, setFile] = useState<{ url: string; name: string; type: string } | null>(null)
  const [uploading, setUploading] = useState(false)
  const [sending, setSending] = useState(false)
  const [sentCount, setSentCount] = useState(0)
  const fileRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  const toggle = (id: string) =>
    setSelected((prev) => {
      const n = new Set(prev)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })

  const handleFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setUploading(true)
    const fd = new FormData()
    fd.append('file', f)
    const res = await fetch('/api/chat/upload', { method: 'POST', body: fd })
    const j = await res.json()
    if (res.ok) setFile({ url: j.url, name: j.name, type: j.type })
    setUploading(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  const send = async () => {
    if ((!text.trim() && !file) || selected.size === 0) return
    setSending(true)
    const rows = participants
      .filter((p) => selected.has(p.influencerId))
      .map((p) => ({
        sender_id: senderId,
        receiver_id: p.influencerId,
        proposal_id: p.proposalId,
        content: text.trim(),
        file_url: file?.url ?? null,
        file_name: file?.name ?? null,
        file_type: file?.type ?? null,
      }))
    await supabase.from('messages').insert(rows)
    setSentCount(rows.length)
    setSending(false)
    setText('')
    setFile(null)
    setTimeout(() => setSentCount(0), 3000)
  }

  const oneToOne = selected.size === 1

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm">
      <h2 className="text-sm font-bold text-gray-800 mb-1">📢 메시지 · 가이드 보내기</h2>
      <p className="text-xs text-gray-400 mb-3">
        확정자에게 기본 선택돼요. <span className="text-gray-500">1명만 선택하면 1:1</span>, 여러 명이면 일괄 발송됩니다.
      </p>

      <div className="flex flex-wrap gap-1.5 mb-3">
        {participants.map((p) => (
          <button
            key={p.influencerId}
            onClick={() => toggle(p.influencerId)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
              selected.has(p.influencerId) ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >
            {p.name}
            {p.confirmed ? ' ·확정' : ''} {selected.has(p.influencerId) ? '✓' : ''}
          </button>
        ))}
      </div>

      {/* 파일 첨부 */}
      <input ref={fileRef} type="file" onChange={handleFile} className="hidden"
        accept=".pdf,.doc,.docx,.hwp,.hwpx,.ppt,.pptx,.xls,.xlsx,.jpg,.jpeg,.png,.zip" />
      <div className="flex items-center gap-2 mb-2">
        <button onClick={() => fileRef.current?.click()} disabled={uploading}
          className="px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 text-xs hover:bg-gray-200 disabled:opacity-50">
          {uploading ? '업로드 중…' : '📎 가이드 파일 첨부'}
        </button>
        {file && (
          <span className="text-xs text-gray-600 flex items-center gap-1 truncate max-w-[160px]">
            📄 {file.name}
            <button onClick={() => setFile(null)} className="text-gray-400 hover:text-red-500">✕</button>
          </span>
        )}
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
        placeholder="예: 가이드 첨부드립니다. 확인 후 촬영 일정 회신 부탁드려요."
      />

      {sentCount > 0 && <p className="text-xs text-green-600 mt-2">✅ {sentCount}명에게 전송했어요</p>}

      <button
        onClick={send}
        disabled={sending || (!text.trim() && !file) || selected.size === 0}
        className="w-full mt-2 bg-amber-500 text-white py-2 rounded-lg text-sm font-medium hover:bg-amber-600 disabled:opacity-50"
      >
        {sending ? '전송 중...' : oneToOne ? '1:1로 보내기' : `${selected.size}명에게 일괄 보내기`}
      </button>
    </div>
  )
}
