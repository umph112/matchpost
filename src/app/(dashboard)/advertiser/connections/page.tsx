'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { initial } from '@/lib/initial'
import { respondConnection, revokeConnection } from '@/lib/connections/actions'
import DashSendButton from '@/components/DashSendButton'
import MatchScore from '@/components/MatchScore'

type ConnectionRow = {
  id: string
  a_id: string
  b_id: string
  a_ok: boolean
  b_ok: boolean
  source: string | null
  otherId: string
  otherName: string
  active: boolean
  proposedByMe: boolean
  followers: number | null
  matchScore: number | null
  reviewCount: number
}

type SourceFilter = '전체' | '협업' | '직접'

// PC 7열 표 — 헤더/데이터 행이 동일 grid 를 써야 어긋나지 않는다.
const PC_COLS = 'minmax(0,1fr) 96px 128px 118px 120px 112px 126px'

export default function AdvertiserConnectionsPage() {
  const [rows, setRows] = useState<ConnectionRow[]>([])
  const [userId, setUserId] = useState('')
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('전체')
  const supabase = createClient()
  const router = useRouter()

  const goToConversation = async (otherId: string) => {
    const { data: convId } = await supabase.rpc('get_or_create_conversation', {
      p_advertiser_id: userId, p_kind: 'personal', p_campaign_id: null, p_other_id: otherId,
    })
    if (convId) router.push(`/advertiser/messages/${convId}`)
  }

  const load = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setUserId(user.id)

    const { data } = await supabase
      .from('connections')
      .select('id, a_id, b_id, a_ok, b_ok, source')
      .or(`a_id.eq.${user.id},b_id.eq.${user.id}`)
      .order('created_at', { ascending: false })

    if (!data || data.length === 0) { setRows([]); setLoading(false); return }

    const otherIds = data.map((c) => (c.a_id === user.id ? c.b_id : c.a_id))
    const [{ data: profiles }, { data: ips }] = await Promise.all([
      supabase.from('profiles').select('id, name').in('id', otherIds),
      supabase.from('influencer_profiles').select('user_id, follower_count, match_score, review_count').in('user_id', otherIds),
    ])
    const nameMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p.name]))
    const ipMap = Object.fromEntries((ips ?? []).map((p) => [p.user_id, p]))

    setRows(
      data.map((c) => {
        const otherId = c.a_id === user.id ? c.b_id : c.a_id
        const ip = ipMap[otherId]
        return {
          ...c,
          otherId,
          otherName: nameMap[otherId] ?? '알 수 없음',
          active: c.a_ok && c.b_ok,
          proposedByMe: !(c.a_ok && c.b_ok) && ((c.a_id === user.id && c.a_ok) || (c.b_id === user.id && c.b_ok)),
          followers: ip?.follower_count ?? null,
          matchScore: ip?.match_score ?? null,
          reviewCount: ip?.review_count ?? 0,
        }
      })
    )
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const accept = async (id: string) => {
    setBusyId(id); setError('')
    const res = await respondConnection(id, true)
    setBusyId(null)
    if (!res.ok) { setError(res.error); return }
    load()
  }

  const decline = async (id: string) => {
    setBusyId(id); setError('')
    const res = await respondConnection(id, false)
    setBusyId(null)
    if (!res.ok) { setError(res.error); return }
    load()
  }

  const revoke = async (id: string) => {
    setBusyId(id); setError('')
    const res = await revokeConnection(id)
    setBusyId(null)
    if (!res.ok) { setError(res.error); return }
    load()
  }

  const active = rows.filter((r) => r.active)
  const incoming = rows.filter((r) => !r.active && !r.proposedByMe)
  const sent = rows.filter((r) => !r.active && r.proposedByMe)

  const activeShown = active.filter((r) =>
    sourceFilter === '전체' ? true : sourceFilter === '협업' ? r.source === 'collab' : r.source === 'manual',
  )

  // 경로 배지 — collab 협업 / manual 직접. invite·null 은 배지 없음(이번 라운드 미배선).
  const sourceBadge = (source: string | null) => {
    if (source === 'collab')
      return <span className="text-[10px] font-bold rounded px-1.5 py-[1px]" style={{ background: '#DCFCE7', color: '#15803D' }}>협업</span>
    if (source === 'manual')
      return <span className="text-[10px] font-bold rounded px-1.5 py-[1px]" style={{ background: '#F1F1F4', color: '#7C7C88' }}>직접</span>
    return null
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-8 [.adv-pc_&]:max-w-none [.adv-pc_&]:px-0 [.adv-pc_&]:py-0">
      <div className="flex items-center mb-8">
        <Link href="/advertiser/dashboard" className="mr-4 text-gray-400 hover:text-gray-600 [.adv-pc_&]:hidden">← 뒤로</Link>
        <h1 className="text-xl font-bold text-gray-900">내 인플루언서</h1>
      </div>

      {loading && <p className="text-center text-gray-400 py-16">불러오는 중...</p>}
      {error && <p className="text-sm text-red-500 mb-4">{error}</p>}

      {!loading && incoming.length > 0 && (
        <div className="mb-6">
          <p className="text-xs font-semibold text-gray-400 mb-2">받은 등록 제안</p>
          {incoming.map((r) => (
            <div key={r.id} className="bg-white rounded-2xl p-4 shadow-sm mb-2 flex items-center justify-between">
              <div className="flex items-center">
                <div className="w-9 h-9 bg-[#FEF3C7] rounded-full flex items-center justify-center text-[#B45309] font-bold mr-3">
                  {initial(r.otherName)}
                </div>
                <p className="font-semibold text-gray-800 text-sm">{r.otherName}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => decline(r.id)} disabled={busyId === r.id}
                  className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50">거절</button>
                <button onClick={() => accept(r.id)} disabled={busyId === r.id}
                  className="text-xs px-3 py-1.5 rounded-lg bg-[#F59E0B] text-white hover:bg-[#D97706]">수락</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-gray-400">등록된 인플루언서 ({active.length}명)</p>
            {active.length > 0 && (
              <div className="flex gap-[3px] bg-[#F1F1F4] rounded-lg p-[3px]">
                {(['전체', '협업', '직접'] as SourceFilter[]).map((f) => (
                  <button
                    key={f}
                    onClick={() => setSourceFilter(f)}
                    className={`text-[11px] font-semibold px-2.5 py-[4px] rounded-md transition ${
                      sourceFilter === f
                        ? 'bg-white text-[#17171B] shadow-[0_1px_2px_rgba(0,0,0,.06)]'
                        : 'text-[#8A8A96] hover:text-[#5C5C68]'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            )}
          </div>
          {active.length === 0 && (
            <p className="text-center text-gray-400 text-sm py-8">
              아직 없어요 — 협업이 정산 완료되면 딜시트에서 등록을 제안할 수 있어요
            </p>
          )}
          {active.length > 0 && activeShown.length === 0 && (
            <p className="text-center text-gray-400 text-sm py-8">이 경로로 등록된 인플루언서가 없어요</p>
          )}
          {/* 모바일: 카드 목록 (그대로 유지) */}
          <div className="[.adv-pc_&]:hidden">
            {activeShown.map((r) => (
              <div key={r.id} className="bg-white rounded-2xl p-4 shadow-sm mb-2 flex items-center justify-between">
                <div className="flex items-center">
                  <div className="w-9 h-9 bg-[#DCFCE7] rounded-full flex items-center justify-center text-[#15803D] font-bold mr-3">
                    {initial(r.otherName)}
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-gray-800 text-sm">{r.otherName}</p>
                    {sourceBadge(r.source)}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <DashSendButton
                    influencerId={r.otherId}
                    influencerName={r.otherName}
                    className="text-xs text-white bg-[#F59E0B] hover:bg-[#D97706] px-3 py-1.5 rounded-lg font-medium"
                  >
                    대시 보내기
                  </DashSendButton>
                  <button onClick={() => goToConversation(r.otherId)} className="text-xs text-[#B45309] hover:underline">
                    대시
                  </button>
                  <button onClick={() => revoke(r.id)} disabled={busyId === r.id}
                    className="text-xs text-gray-300 hover:text-red-500">해제</button>
                </div>
              </div>
            ))}
          </div>

          {/* PC: 7열 표 */}
          {activeShown.length > 0 && (
            <div className="hidden [.adv-pc_&]:block bg-white border border-[#EAEAEE] rounded-[14px] overflow-hidden">
              <div
                className="grid items-center"
                style={{ gridTemplateColumns: PC_COLS, padding: '10px 20px', background: '#FAFAFB', borderBottom: '1px solid #F1F1F4' }}
              >
                {['인플루언서', '경로', '등급', '팔로워', '최근 활동', '매치', ''].map((h, i) => (
                  <span key={i} className="text-[11px] font-bold text-[#9A9AA5]">{h}</span>
                ))}
              </div>
              {activeShown.map((r) => (
                <div
                  key={r.id}
                  className="grid items-center hover:bg-[#FAFAFB] transition"
                  style={{ gridTemplateColumns: PC_COLS, padding: '14px 20px', borderBottom: '1px solid #F5F5F7' }}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-[#FEF3C7] text-[#B45309] text-[13px] font-extrabold flex items-center justify-center shrink-0">
                      {initial(r.otherName)}
                    </div>
                    <p className="text-[13px] font-semibold text-[#17171B] truncate">{r.otherName}</p>
                  </div>
                  <div>{sourceBadge(r.source) ?? <span className="text-[#C4C4CE]">—</span>}</div>
                  <span className="text-[12.5px] text-[#C4C4CE]">—</span>
                  <span className="text-[12.5px] text-[#3C3C46] tabular-nums">
                    {r.followers != null ? r.followers.toLocaleString() : <span className="text-[#C4C4CE]">—</span>}
                  </span>
                  <span className="text-[12.5px] text-[#C4C4CE]">—</span>
                  <div><MatchScore score={r.matchScore} reviewCount={r.reviewCount} /></div>
                  <div className="flex items-center justify-end gap-2.5">
                    <DashSendButton
                      influencerId={r.otherId}
                      influencerName={r.otherName}
                      className="text-[11.5px] text-white bg-[#F59E0B] hover:bg-[#D97706] px-2.5 py-1.5 rounded-lg font-semibold whitespace-nowrap"
                    >
                      대시
                    </DashSendButton>
                    <button onClick={() => revoke(r.id)} disabled={busyId === r.id}
                      className="text-[11.5px] text-[#C4C4CE] hover:text-red-500 shrink-0">해제</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {!loading && sent.length > 0 && (
        <div className="mt-6">
          <p className="text-xs font-semibold text-gray-400 mb-2">보낸 제안 — 상대 수락 대기 중</p>
          {sent.map((r) => (
            <div key={r.id} className="bg-white rounded-2xl p-4 shadow-sm mb-2 flex items-center justify-between">
              <div className="flex items-center">
                <div className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center text-gray-500 font-bold mr-3">
                  {initial(r.otherName)}
                </div>
                <p className="font-semibold text-gray-800 text-sm">{r.otherName}</p>
              </div>
              <button onClick={() => revoke(r.id)} disabled={busyId === r.id}
                className="text-xs text-gray-300 hover:text-red-500">취소</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
