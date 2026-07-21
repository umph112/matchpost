'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import LogoutButton from '@/components/LogoutButton'

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
  const router = useRouter()
  const supabase = createClient()

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

      const { data: priv } = await supabase
        .from('user_private')
        .select('phone')
        .eq('user_id', user.id)
        .single()

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
    <div className="max-w-lg mx-auto px-4 py-8">
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
        <div className="bg-green-50 text-green-600 text-sm p-3 rounded-lg mb-4">✅ 저장됐어요!</div>
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
            className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-500 mb-1">전화번호</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
          className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
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
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
        <div className="space-y-2">
          <input type="text" value={instagramUrl} onChange={(e) => setInstagramUrl(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="인스타그램 URL" />
          <input type="text" value={youtubeUrl} onChange={(e) => setYoutubeUrl(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="유튜브 URL" />
          <input type="text" value={blogUrl} onChange={(e) => setBlogUrl(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                  ? 'bg-blue-600 text-white'
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
          className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
          className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="포트폴리오 링크 입력"
        />
      </div>

      {/* 저장 버튼 */}
      <button
        onClick={handleSave}
        disabled={loading}
        className="w-full bg-blue-600 text-white py-3 rounded-xl font-medium hover:bg-blue-700 transition disabled:opacity-50"
      >
        {loading ? '저장 중...' : '저장하기'}
      </button>
    </div>
  )
}