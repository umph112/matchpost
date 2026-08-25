'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import LogoutButton from '@/components/LogoutButton'
import { BarChart3 } from 'lucide-react'
import SaveButton, { useSaveState } from '@/components/SaveButton'
import { unregisterConnection } from '@/lib/connections/actions'
import { firstReportLabel } from '@/lib/blogAnalyzer/schedule'
import { INFLUENCER_CATEGORIES, CATEGORY_ETC } from '@/lib/categories'

// 분야 목록은 lib/categories 하나만 쓴다. 예전엔 이 파일이 자체 목록('맛집·라이프스타일·
// 반려동물·피트니스·테크')을 들고 있었는데, 가입 화면과 캠페인 검색은 lib/categories를 쓴다.
// 어휘가 다르면 가입 때 고른 '푸드'가 여기서 선택 안 된 것처럼 보이고, 저장하는 순간
// 검색에 걸리지 않는 값('맛집')으로 바뀐다.
const PLATFORMS = ['인스타그램', '유튜브', '블로그', '틱톡']

// 입력값은 화면에서 가장 진해야 하는 글자다 — 색을 상속에 맡기지 않는다.
const inputCls =
  'w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm ' +
  'text-[#17171B] placeholder:text-[#B0B0BB] ' +
  'focus:outline-none focus:ring-2 focus:ring-amber-400'

export default function InfluencerProfilePage() {
  const [profile, setProfile] = useState<any>(null)
  const [influencerProfile, setInfluencerProfile] = useState<any>(null)
  // profiles.name = 활동명(광고주에게 보이는 이름), user_private.real_name = 실명.
  // 가입 화면이 둘을 따로 받는데(activityName / name) 여기엔 칸이 하나뿐이었고,
  // 그 하나가 profiles.name을 고치면서 라벨만 「이름」이었다 — 활동명을 고치는 줄 몰랐다.
  const [activityName, setActivityName] = useState('')
  const [realName, setRealName] = useState('')
  const [phone, setPhone] = useState('')
  const [bio, setBio] = useState('')
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([])
  // 가입과 같은 모양으로 — 메이저 1 + 서브 최대 2. 저장은 [메이저, ...서브] 한 배열이고
  // 광고주 대시보드·검색이 categories[0]을 메이저로 읽는다(그래서 순서가 의미를 가진다).
  const [majorCategory, setMajorCategory] = useState('')
  const [subCategories, setSubCategories] = useState<string[]>([])
  const [etcText, setEtcText] = useState('')
  const [followerCount, setFollowerCount] = useState('')
  const [instagramUrl, setInstagramUrl] = useState('')
  const [youtubeUrl, setYoutubeUrl] = useState('')
  const [blogUrl, setBlogUrl] = useState('')
  // D25 §2 — 입력칸의 값(blogUrl)과 "저장된 값"을 나눠 둔다.
  // 타이핑만 한 상태에서 「채널을 등록했어요」가 뜨면 등록된 줄 알고 나가버린다.
  const [savedBlogUrl, setSavedBlogUrl] = useState('')
  // D28 §4 — 이번 저장에서 채널을 "처음" 등록했는지. 첫 등록에만 다음 걸음을 붙인다.
  // 매번 붙이면 여러 항목을 이어서 고칠 때 방해가 된다.
  const [justRegistered, setJustRegistered] = useState(false)
  const [hasReport, setHasReport] = useState(false)
  const [portfolioUrl, setPortfolioUrl] = useState('')
  // D23 봇 §2 — 불러오기가 끝나기 전에는 폼을 그리지 않는다.
  // 빈 폼이 먼저 뜨면 사람은 그게 「내 값이 없는 것」인 줄 알고 그대로 저장을 누르고,
  // 그 순간 이름·전화번호가 빈 문자열로 덮인다(봇이 실제로 그렇게 날렸다).
  const [ready, setReady] = useState(false)
  // D31 [4] — 저장 버튼의 네 상태(하기/중/했어요/실패)는 SaveButton 이 들고 있다.
  const save = useSaveState()
  // 「값이 안 바뀌었으면 회색」을 판단할 기준값. 불러온 직후와 저장 성공 직후에 찍는다.
  const [savedSnapshot, setSavedSnapshot] = useState<string | null>(null)
  // 나를 친구등록한 광고주 (해제 가능, 해제해도 광고주에게 알리지 않는다)
  const [advConns, setAdvConns] = useState<{ otherId: string; name: string; source: string | null }[]>([])
  const [unregBusy, setUnregBusy] = useState<string | null>(null)
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
      if (!user) { setReady(true); return }

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

      const { data: priv } = await supabase.from('user_private').select('phone, real_name').eq('user_id', user.id).single()

      if (p) {
        setProfile(p)
        setActivityName(p.name ?? '')
        setRealName(priv?.real_name ?? '')
        setPhone(priv?.phone ?? '')
      }
      if (ip) {
        setInfluencerProfile(ip)
        setBio(ip.bio ?? '')
        setSelectedPlatforms(ip.platforms ?? [])
        // 저장된 배열을 가입 화면과 같은 모양(메이저 1 + 서브 2)으로 되돌린다.
        // 목록에 없는 값은 가입 때 '기타'로 직접 입력한 값이다(가입이 입력값을 그대로 저장한다).
        // 예전 자체 목록으로 저장된 값('맛집' 등)도 같은 경로로 살아남는다 — 조용히 지우지 않는다.
        const cats: string[] = ip.categories ?? []
        const known = (c: string) => INFLUENCER_CATEGORIES.includes(c)
        const custom = cats.find((c) => c && !known(c))
        if (custom) setEtcText(custom)
        const major = cats[0] ? (known(cats[0]) ? cats[0] : CATEGORY_ETC) : ''
        setMajorCategory(major)
        setSubCategories(
          cats.slice(1, 3).map((c) => (known(c) ? c : CATEGORY_ETC)).filter((c) => c && c !== major),
        )
        setFollowerCount(ip.follower_count?.toString() ?? '')
        setInstagramUrl(ip.instagram_url ?? '')
        setYoutubeUrl(ip.youtube_url ?? '')
        setBlogUrl(ip.blog_url ?? '')
        setSavedBlogUrl(ip.blog_url ?? '')
        setPortfolioUrl(ip.portfolio_url ?? '')
      }

      // 이미 리포트가 한 번이라도 나온 사람에게 「첫 리포트」 안내를 띄우지 않기 위해
      const { data: ba } = await supabase
        .from('blog_analytics')
        .select('blog_id')
        .eq('user_id', user.id)
        .maybeSingle()
      setHasReport(!!ba?.blog_id)
      setReady(true)
    }
    fetchProfile()
  }, [])

  const togglePlatform = (p: string) => {
    setSelectedPlatforms(prev =>
      prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]
    )
  }

  // 아래 셋은 가입 화면(InfluencerSignup)과 같은 규칙이다 — 한쪽만 바꾸지 말 것.
  const etcSelected = majorCategory === CATEGORY_ETC || subCategories.includes(CATEGORY_ETC)

  const selectMajor = (c: string) => {
    setMajorCategory(prev => (prev === c ? '' : c))
    setSubCategories(prev => prev.filter(x => x !== c))
  }

  const toggleSub = (c: string) => {
    setSubCategories(prev => {
      if (prev.includes(c)) return prev.filter(x => x !== c)
      if (prev.length >= 2) return prev
      return [...prev, c]
    })
  }

  const buildCategories = () => {
    const major = majorCategory === CATEGORY_ETC ? etcText.trim() : majorCategory
    const subs = subCategories.map(s => (s === CATEGORY_ETC ? etcText.trim() : s))
    return [major, ...subs].filter(Boolean)
  }

  // 저장하는 값 전부를 한 줄로 — 이것이 달라지면 바뀐 것이다.
  const formSnapshot = () =>
    JSON.stringify([
      activityName, realName, phone, bio, selectedPlatforms, buildCategories(),
      followerCount, instagramUrl, youtubeUrl, blogUrl, portfolioUrl,
    ])

  // 불러오기가 끝난 첫 렌더에서 기준값을 찍는다(그 전에 찍으면 빈 폼이 기준이 된다).
  useEffect(() => {
    if (ready && savedSnapshot === null) setSavedSnapshot(formSnapshot())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready])

  const snapshot = formSnapshot()
  const dirty = savedSnapshot !== null && snapshot !== savedSnapshot

  // 실패한 뒤 값을 고치면 「저장 실패」를 지운다 — 고쳤는데도 빨간 채로 있으면
  // 방금 고친 것 때문에 또 실패한 줄 안다.
  useEffect(() => {
    if (save.status === 'failed') save.reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshot])

  const handleSave = () =>
    save.run(async () => {
      if (etcSelected && !etcText.trim()) return '기타 분야를 직접 입력해주세요.'

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return '로그인이 풀렸어요. 새로고침 후 다시 로그인해주세요.'

      return await persist(user.id)
    })

  // 실제로 쓰는 부분. 실패 이유를 문자열로 돌려주면 버튼이 「저장 실패」가 된다.
  const persist = async (userId: string): Promise<string | null> => {
    // ⚠️ UPDATE 가 RLS 에 걸려 한 행도 못 고치면 error 는 null 이고 data 는 [] 로 온다.
    // error 만 보면 「성공」으로 읽힌다 — 실제로 influencer_profiles 저장이 통째로
    // 버려지는 동안 화면엔 「저장됐어요!」가 떴다. 그래서 .select() 로 돌아온 행을 센다.
    const { data: profileRows, error: profileError } = await supabase
      .from('profiles')
      .update({ name: activityName })
      .eq('id', userId)
      .select('id')

    const { data: privRows, error: privError } = await supabase
      .from('user_private')
      .upsert({ user_id: userId, phone, real_name: realName }, { onConflict: 'user_id' })
      .select('user_id')

    const { data: ipRows, error: ipError } = await supabase
      .from('influencer_profiles')
      .update({
        bio,
        platforms: selectedPlatforms,
        categories: buildCategories(),
        follower_count: followerCount ? parseInt(followerCount) : 0,
        instagram_url: instagramUrl,
        youtube_url: youtubeUrl,
        blog_url: blogUrl,
        portfolio_url: portfolioUrl,
      })
      .eq('user_id', userId)
      .select('user_id')

    // 「저장했어요 ✓」보다 먼저 확인한다 — 순서가 바뀌면 안내가 거짓말이 된다.
    const failed: string[] = []
    if (profileError || !profileRows?.length) failed.push('활동명')
    if (privError || !privRows?.length) failed.push('이름 · 전화번호')
    if (ipError || !ipRows?.length) failed.push('소개 · 플랫폼 · 분야 · 채널')

    if (failed.length > 0) {
      return `저장되지 않았어요 — ${failed.join(', ')}. 새로고침 후 다시 시도해주세요.`
    }

    // D28 §4 — 비어 있던 채널이 이번 저장으로 채워졌으면 첫 등록이다.
    setJustRegistered(savedBlogUrl.trim() === '' && blogUrl.trim() !== '')
    setSavedBlogUrl(blogUrl) // D25 §2 — 저장이 끝난 뒤에만 안내 카드가 뜨도록
    setSavedSnapshot(formSnapshot()) // 방금 저장한 값이 새 기준 — 버튼이 다시 회색이 된다
    return null
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-8 [.inf-pc_&]:max-w-none [.inf-pc_&]:px-0 [.inf-pc_&]:py-0">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center">
          {/* D31 4절 — 모바일 뒤로가기는 셸 상단바가 갖는다(여기 두면 두 개가 된다).
              PC 는 온 길(back)이 아니라 정해진 상위 화면으로 간다 — 어디서 왔든 같은 곳. */}
          <Link href="/influencer/dashboard" className="hidden [.inf-pc_&]:inline-block mr-4 text-gray-400 hover:text-gray-600">
            ← 뒤로
          </Link>
          <h1 className="text-xl font-bold text-gray-900">내 정보 수정</h1>
        </div>
        <LogoutButton />
      </div>

      {/* 불러오기 전에는 폼 대신 이 자리를 보여준다 — 빈 칸을 「값이 없다」로 읽고
          저장을 눌러 기존 값을 날리는 일을 막는다. */}
      {!ready && (
        <div className="bg-white rounded-2xl p-8 shadow-sm text-center">
          <p className="text-sm text-[#7C7C88]">내 정보를 불러오는 중이에요…</p>
        </div>
      )}

      {ready && <>

      {/* D31 [4] — 알림 배너를 화면 맨 위에 두지 않는다. 폼이 길어서 저장을 누른 사람은
          여기를 못 본다(눌러도 아무 일 없는 것처럼 보였다). 성공도 실패도 버튼 자리에서 말한다. */}

      {/* 기본 정보 */}
      <div className="bg-white rounded-2xl p-5 shadow-sm mb-4">
        <h2 className="font-semibold text-gray-800 mb-4">기본 정보</h2>
        <div className="mb-3">
          <label className="block text-sm text-gray-500 mb-1">
            이름 <span className="text-gray-400">(실명)</span>
          </label>
          <input
            type="text"
            value={realName}
            onChange={(e) => setRealName(e.target.value)}
            className={inputCls}
            placeholder="이름 입력"
          />
          <p className="text-xs text-gray-400 mt-1">공개되지 않아요. 정산·세금 처리에만 쓰입니다.</p>
        </div>
        <div className="mb-3">
          <label className="block text-sm text-gray-500 mb-1">
            활동명 <span className="text-gray-400">(공개 표시 이름)</span>
          </label>
          <input
            type="text"
            value={activityName}
            onChange={(e) => setActivityName(e.target.value)}
            className={inputCls}
            placeholder="예: 여행하는 지니"
          />
          <p className="text-xs text-gray-400 mt-1">광고주에게 이 이름으로 보여요.</p>
        </div>
        <div>
          <label className="block text-sm text-gray-500 mb-1">전화번호</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className={inputCls}
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
          className={`${inputCls} resize-none`}
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
            className={inputCls}
            placeholder="인스타그램 URL" />
          <input type="text" value={youtubeUrl} onChange={(e) => setYoutubeUrl(e.target.value)}
            className={inputCls}
            placeholder="유튜브 URL" />
          <input type="text" value={blogUrl} onChange={(e) => setBlogUrl(e.target.value)}
            className={inputCls}
            placeholder="블로그 URL" />

          {/* D25 §2 — 등록해도 화면이 그대로면 "안 된 건가" 싶다.
              분석은 밤 10시 배치가 한 번 돌아야 생기므로, 등록한 그 자리에서 언제부터 볼 수 있는지 알려준다. */}
          {savedBlogUrl.trim() !== '' && !hasReport && (
            <div className="rounded-[11px] border border-[#FDE68A] bg-[#FFFBEB] px-4 py-3.5">
              <p className="text-[13px] font-bold text-[#92400E]">채널을 등록했어요</p>
              <p className="mt-1 text-[11.5px] text-[#B45309] leading-[1.65]">
                {firstReportLabel()}에 첫 리포트가 만들어져요.
                <br />
                방문자 · 이웃 수 · 발행 주기를 모아 등급을 계산합니다.
              </p>
              {/* D28 §4 — 저장하고 아무 일도 안 일어나면 다음에 뭘 해야 할지 모른다.
                  단, 첫 등록일 때만 길을 낸다. 매번 띄우면 여러 항목을 고칠 때 방해가 된다. */}
              {justRegistered && (
                <Link
                  href="/influencer/channel-analytics"
                  className="mt-3 inline-flex items-center text-[12px] font-bold text-[#92400E] hover:underline"
                >
                  내 채널 분석 보기 →
                </Link>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 카테고리 — 가입 화면과 같은 어휘·같은 모양(메이저 1 + 서브 2).
          한쪽만 바꾸면 광고주 검색이 못 찾는 값이 저장된다. */}
      <div className="bg-white rounded-2xl p-5 shadow-sm mb-4">
        <h2 className="font-semibold text-gray-800 mb-4">활동 분야</h2>
        <label className="block text-sm text-gray-500 mb-2">
          메이저 분야 <span className="text-[#B45309]">(1개 필수)</span>
        </label>
        <div className="flex flex-wrap gap-1.5 mb-4">
          {INFLUENCER_CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => selectMajor(cat)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
                majorCategory === cat
                  ? 'bg-[#F59E0B] text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
        <label className="block text-sm text-gray-500 mb-2">
          서브 분야 <span className="text-gray-400">(최대 2개 · 선택)</span>
          <span className="ml-1 text-gray-400">{subCategories.length}/2</span>
        </label>
        <div className="flex flex-wrap gap-1.5">
          {INFLUENCER_CATEGORIES.filter((c) => c !== majorCategory).map((cat) => {
            const on = subCategories.includes(cat)
            const disabled = !on && subCategories.length >= 2
            return (
              <button
                key={cat}
                onClick={() => toggleSub(cat)}
                disabled={disabled}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
                  on
                    ? 'bg-[#F59E0B] text-white'
                    : disabled
                      ? 'bg-gray-50 text-gray-300 cursor-not-allowed'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {cat}
              </button>
            )
          })}
        </div>
        {etcSelected && (
          <input
            type="text"
            value={etcText}
            onChange={(e) => setEtcText(e.target.value)}
            className={`${inputCls} mt-3`}
            placeholder="기타 분야 직접 입력"
          />
        )}
      </div>

      {/* 팔로워 수 */}
      <div className="bg-white rounded-2xl p-5 shadow-sm mb-4">
        <h2 className="font-semibold text-gray-800 mb-4">팔로워 수</h2>
        <input
          type="number"
          value={followerCount}
          onChange={(e) => setFollowerCount(e.target.value)}
          className={inputCls}
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
          className={inputCls}
          placeholder="포트폴리오 링크 입력"
        />
      </div>

      {/* 저장 버튼 — 상태 네 가지와 「바뀐 값이 없으면 회색」은 SaveButton 안에 있다 */}
      <SaveButton
        status={save.status}
        error={save.error}
        onClick={handleSave}
        disabled={!dirty}
        disabledHint={dirty ? undefined : '바뀐 값이 없어요'}
      />

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

      </>}
    </div>
  )
}