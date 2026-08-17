'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import LogoutButton from '@/components/LogoutButton'
import { CircleCheck, BarChart3 } from 'lucide-react'
import { unregisterConnection } from '@/lib/connections/actions'

const CATEGORIES = ['맛집', '패션', '뷰티', '여행', '라이프스타일', '육아', '반려동물', '피트니스', '테크', '기타']
const PLATFORMS = ['인스타그램', '유튜브', '블로그', '틱톡']

export default function InfluencerProfilePage() {
  const [profile, setProfile] = useState<any>(null)
  const [influencerProfile, setInfluencerProfile] = useState<any>(null)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [bio, setBio] = useState('')
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([])
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [followerCount, setFollowerCount] = useState('')
  const [instagramUrl, setInstagramUrl] = useState('')
  const [youtubeUrl, setYoutubeUrl] = useState('')
  const [blogUrl, setBlogUrl] = useState('')
  const [portfolioUrl, setPortfolioUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  // 나를 친구등록한 광고주 (해제 가능, 해제해도 광고주에게 알리지 않는다)
  const [advConns, setAdvConns] = useState<{ otherId: string; name: string; source: string | null }[]>([])
  const [unregBusy, setUnregBusy] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  const loadAdvConns = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: conns } = await supabase
      .from('connections')
      .select('a_id, b_id, a_ok, b_ok, source, created_at')
      .or(`a_id.eq.${user.id},b_id.eq.${user.id}`)
      .order('created_at', { ascending: false })
    const rows = (conns ?? []).filter((c: any) => c.a_ok && c.b_ok)
    const otherIds = rows.map((c: any) => (c.a_id === user.id ? c.b_id : c.a_id))
    if (otherIds.length === 0) {
      setAdvConns([])
      return
    }
    const { data: profs } = await supabase.from('profiles').select('id, name').in('id', otherIds)
    const nameOf = new Map((profs ?? []).map((p: any) => [p.id, p.name]))
    setAdvConns(
      rows.map((c: any) => {
        const other = c.a_id === user.id ? c.b_id : c.a_id
        return { otherId: other, name: nameOf.get(other) ?? '광고주', source: c.source }
      }),
    )
  }

  useEffect(() => {
    loadAdvConns()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const unregister = async (advertiserId: string) => {
    setUnregBusy(advertiserId)
    const res = await unregisterConnection(advertiserId)
    setUnregBusy(null)
    if (res.ok) loadAdvConns()
  }

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: p } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      const { data: ip } = await supabase
        .from('influencer_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single()

      const { data: priv } = await supabase.from('user_private').select('phone').eq('user_id', user.id).single()

      if (p) {
        setProfile(p)
        setName(p.name ?? '')
        setPhone(priv?.phone ?? '')
      }
      if (ip) {
        setInfluencerProfile(ip)
        setBio(ip.bio ?? '')
        setSelectedPlatforms(ip.platforms ?? [])
        setSelectedCategories(ip.categories ?? [])
        setFollowerCount(ip.follower_count?.toString() ?? '')
        setInstagramUrl(ip.instagram_url ?? '')
        setYoutubeUrl(ip.youtube_url ?? '')
        setBlogUrl(ip.blog_url ?? '')
        setPortfolioUrl(ip.portfolio_url ?? '')
      }
    }
    fetchProfile()
  }, [])

  const togglePlatform = (p: string) => {
    setSelectedPlatforms(prev =>
      prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]
    )
  }

  const toggleCategory = (c: string) => {
    setSelectedCategories(prev =>
      prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]
    )
  }

  const handleSave = async () => {
    setLoading(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error: profileError } = await supabase
      .from('profiles')
      .update({ name })
      .eq('id', user.id)

    await supabase
      .from('user_private')
      .upsert({ user_id: user.id, phone }, { onConflict: 'user_id' })

    const { error: ipError } = await supabase
      .from('influencer_profiles')
      .update({
        bio,
        platforms: selectedPlatforms,
        categories: selectedCategories,
        follower_count: followerCount ? parseInt(followerCount) : 0,
        instagram_url: instagramUrl,
        youtube_url: youtubeUrl,
        blog_url: blogUrl,
        portfolio_url: portfolioUrl,
      })
      .eq('user_id', user.id)

    if (profileError || ipError) {
      setError('저장에 실패했어요. 다시 시도해주세요.')
      setLoading(false)
      return
    }

    setSuccess(true)
    setTimeout(() => setSuccess(false), 2000)
    setLoading(false)
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-8 [.inf-pc_&]:max-w-none [.inf-pc_&]:px-0 [.inf-pc_&]:py-0">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center">
          <button onClick={() => router.back()} className="mr-4 text-gray-400 hover:text-gray-600">
            ← 뒤로
          </button>
          <h1 className="text-xl font-bold text-gray-900">내 정보 수정</h1>
        </div>
        <LogoutButton />
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg mb-4">{error}</div>
      )}
      {success && (
        <div className="bg-green-50 text-green-600 text-sm p-3 rounded-lg mb-4 flex items-center gap-1"><CircleCheck size={16} strokeWidth={1.75} className="text-[#15803D]" /> 저장됐어요!</div>
      )}

      {/* 기본 정보 */}
      <div className="bg-white rounded-2xl p-5 shadow-sm mb-4">
        <h2 className="font-semibold text-gray-800 mb-4">기본 정보</h2>
        <div className="mb-3">
          <label className="block text-sm text-gray-500 mb-1">이름</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-500 mb-1">전화번호</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
        </div>
      </div>

      {/* 소개 */}
      <div className="bg-white rounded-2xl p-5 shadow-sm mb-4">
        <h2 className="font-semibold text-gray-800 mb-4">자기 소개</h2>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          rows={4}
          className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
          placeholder="광고주에게 보여질 자기 소개를 작성해주세요."
        />
      </div>

      {/* 플랫폼 */}
      <div className="bg-white rounded-2xl p-5 shadow-sm mb-4">
        <h2 className="font-semibold text-gray-800 mb-4">활동 플랫폼</h2>
        <div className="flex flex-wrap gap-2 mb-4">
          {PLATFORMS.map(p => (
            <button
              key={p}
              onClick={() => togglePlatform(p)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition ${
                selectedPlatforms.includes(p)
                  ? 'bg-[#F59E0B] text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
        <div className="space-y-2">
          <input type="text" value={instagramUrl} onChange={(e) => setInstagramUrl(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            placeholder="인스타그램 URL" />
          <input type="text" value={youtubeUrl} onChange={(e) => setYoutubeUrl(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            placeholder="유튜브 URL" />
          <input type="text" value={blogUrl} onChange={(e) => setBlogUrl(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            placeholder="블로그 URL" />
        </div>
      </div>

      {/* 카테고리 */}
      <div className="bg-white rounded-2xl p-5 shadow-sm mb-4">
        <h2 className="font-semibold text-gray-800 mb-4">콘텐츠 카테고리</h2>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => toggleCategory(cat)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition ${
                selectedCategories.includes(cat)
                  ? 'bg-[#F59E0B] text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* 팔로워 수 */}
      <div className="bg-white rounded-2xl p-5 shadow-sm mb-4">
        <h2 className="font-semibold text-gray-800 mb-4">팔로워 수</h2>
        <input
          type="number"
          value={followerCount}
          onChange={(e) => setFollowerCount(e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
          placeholder="총 팔로워 수 입력"
        />
      </div>

      {/* 포트폴리오 */}
      <div className="bg-white rounded-2xl p-5 shadow-sm mb-6">
        <h2 className="font-semibold text-gray-800 mb-4">포트폴리오 URL</h2>
        <input
          type="text"
          value={portfolioUrl}
          onChange={(e) => setPortfolioUrl(e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
          placeholder="포트폴리오 링크 입력"
        />
      </div>

      {/* 저장 버튼 */}
      <button
        onClick={handleSave}
        disabled={loading}
        className="w-full bg-[#F59E0B] text-white py-3 rounded-xl font-medium hover:bg-[#D97706] transition disabled:opacity-50"
      >
        {loading ? '저장 중...' : '저장하기'}
      </button>

      {/* 나를 친구등록한 광고주 */}
      {advConns.length > 0 && (
        <div className="bg-white rounded-2xl p-5 shadow-sm mt-4">
          <h2 className="font-semibold text-gray-800 mb-1">나를 친구등록한 광고주</h2>
          <p className="text-xs text-gray-400 mb-4">
            새 캠페인 소식을 먼저 받아볼 수 있어요. 원치 않으면 해제할 수 있어요.
          </p>
          <div className="space-y-2">
            {advConns.map((c) => (
              <div key={c.otherId} className="flex items-center justify-between py-1.5">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-800 text-sm">{c.name}</span>
                  {c.source === 'collab' && (
                    <span className="text-[10px] font-bold rounded px-1.5 py-[1px]" style={{ background: '#DCFCE7', color: '#15803D' }}>협업</span>
                  )}
                  {c.source === 'manual' && (
                    <span className="text-[10px] font-bold rounded px-1.5 py-[1px]" style={{ background: '#F1F1F4', color: '#7C7C88' }}>직접</span>
                  )}
                </div>
                <button
                  onClick={() => unregister(c.otherId)}
                  disabled={unregBusy === c.otherId}
                  className="text-xs text-gray-300 hover:text-red-500 disabled:opacity-50"
                >
                  {unregBusy === c.otherId ? '해제 중...' : '해제'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 내 채널 분석 바로가기 */}
      <Link
        href="/influencer/channel-analytics"
        className="flex items-center justify-between mt-4 bg-[#F6F6F7] rounded-2xl px-4 py-3 hover:bg-[#EAEAEE] transition"
      >
        <span className="text-sm font-medium text-gray-700 flex items-center gap-1"><BarChart3 size={16} strokeWidth={1.75} /> 내 채널 분석 보기</span>
        <span className="text-sm text-gray-400">→</span>
      </Link>
    </div>
  )
}