import { createServiceClient } from '@/lib/supabase/service'
import { notFound } from 'next/navigation'
import { listDateLabel } from '@/lib/date'
import CancelBadge from '@/components/CancelBadge'

export const dynamic = 'force-dynamic'

// 활동 기간 — 가입일(profiles.created_at)부터 지금까지. 「N년 N개월」.
function activityPeriod(createdAt: string | null): string {
  if (!createdAt) return '—'
  const start = new Date(createdAt)
  const now = new Date()
  let months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth())
  if (now.getDate() < start.getDate()) months -= 1
  if (months < 1) return '이번 달 시작'
  const y = Math.floor(months / 12)
  const m = months % 12
  if (y === 0) return `${m}개월`
  if (m === 0) return `${y}년`
  return `${y}년 ${m}개월`
}

export default async function AdvertiserPublicProfile({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  // 로그인 없이 열리는 공개 URL — profile/[id]와 같은 서비스 롤 읽기(집계·리뷰는 RLS로 막혀 있음)
  const supabase = createServiceClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, name, created_at, role, manager_phone, cancellation_count')
    .eq('id', id)
    .single()

  if (!profile) notFound()

  // advertiser_profiles는 select('*') — 0082 미실행 환경에서도 안전(없는 컬럼은 undefined)
  const { data: ap } = await supabase
    .from('advertiser_profiles')
    .select('*')
    .eq('user_id', id)
    .maybeSingle()

  // 인플루언서 겸업 배지 — 같은 계정이 인플루언서 프로필도 가질 때만
  const { data: infl } = await supabase
    .from('influencer_profiles')
    .select('user_id')
    .eq('user_id', id)
    .maybeSingle()

  // 정산 성실도(광고주가 고칠 수 없는 값)
  const { data: score } = await supabase
    .from('advertiser_payment_score')
    .select('on_time_rate, late_count, avg_late_days, deals_count')
    .eq('advertiser_id', id)
    .maybeSingle()

  // 협업 건수 — 정산 완료된 건
  const { count: dealCount } = await supabase
    .from('proposals')
    .select('id', { count: 'exact', head: true })
    .eq('advertiser_id', id)
    .not('settled_at', 'is', null)

  // 받은 평가 — 인플루언서가 이 광고주에게 남긴 공개 리뷰(이름은 비공개)
  const { data: reviews } = await supabase
    .from('reviews')
    .select('stars, tags, private_note, created_at')
    .eq('ratee_id', id)
    .eq('role', 'influencer')
    .eq('is_revealed', true)
    .order('created_at', { ascending: false })

  const reviewList = reviews ?? []
  const ratingCount = reviewList.length
  const ratingAvg =
    ratingCount > 0 ? reviewList.reduce((s, r) => s + (r.stars ?? 0), 0) / ratingCount : null

  const companyName = ap?.company_name || profile.name || '광고주'

  // 마케팅 문의 연락처 — 대행 문의를 받겠다고 켠(marketing_contact_public) 계정만 노출한다.
  // 직접 입력한 marketing_email/phone 이 비어 있으면 등록 연락처로 폴백(이메일=user_private.email, 전화=profiles.manager_phone).
  let contactEmail: string | null = null
  let contactPhone: string | null = null
  if (ap?.marketing_contact_public) {
    contactEmail = (ap?.marketing_email as string | null) || null
    contactPhone = (ap?.marketing_phone as string | null) || null
    if (!contactEmail) {
      const { data: priv } = await supabase
        .from('user_private')
        .select('email')
        .eq('user_id', id)
        .maybeSingle()
      contactEmail = priv?.email ?? null
    }
    if (!contactPhone) contactPhone = profile.manager_phone ?? null
  }

  // 정산 카드 값 + 무지연이면 green
  const noDelay = !!score && score.late_count === 0 && (score.deals_count ?? 0) > 0
  let settleValue: string
  if (!score || !score.deals_count) settleValue = '기록 준비 중'
  else if (score.late_count === 0) settleValue = '무지연'
  else settleValue = `평균 ${Math.round(score.avg_late_days ?? 0)}일 지연`

  // 한 줄 소개 — one_line 우선, 비면 소개(intro) 첫 문장
  const oneLine =
    (ap?.one_line?.trim() as string | undefined) ||
    (ap?.intro ? (ap.intro as string).split(/(?<=[.!?。])\s|\n/)[0]?.trim() : '')

  const card = 'bg-white rounded-2xl p-5 shadow-sm'
  const writtenBadge = (
    <span className="text-[10.5px] font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
      직접 작성
    </span>
  )

  const records: { label: string; value: string; green?: boolean }[] = [
    { label: '정산', value: settleValue, green: noDelay },
    { label: '협업', value: `${dealCount ?? 0}건` },
    { label: '활동 기간', value: activityPeriod(profile.created_at) },
    { label: '평가', value: ratingAvg != null ? `${ratingAvg.toFixed(1)} (${ratingCount}건)` : '아직 없음' },
  ]

  return (
    <div className="min-h-screen bg-[#FAFAFB] py-8 px-4">
      <div className="max-w-[1080px] mx-auto flex flex-col gap-[14px]">
        {/* 머리 */}
        <div className="flex items-center gap-[9px] flex-wrap">
          <h1 className="text-[26px] font-extrabold text-[#17171B] tracking-[-0.035em]">
            {companyName}
          </h1>
          {ap?.biz_reg_number && (
            <span className="text-xs font-semibold text-[#16A34A] bg-[#F0FDF4] border border-[#BBF7D0] px-2 py-0.5 rounded-full">
              사업자 확인
            </span>
          )}
          {infl && (
            <span className="text-xs font-semibold text-[#B45309] bg-[#FEF3C7] px-2 py-0.5 rounded-full">
              인플루언서로도 활동 중
            </span>
          )}
          <CancelBadge role="advertiser" count={profile.cancellation_count} />
        </div>

        {oneLine && <p className="text-sm text-[#5C5C68] leading-relaxed -mt-1">{oneLine}</p>}

        {/* 매치포스트 기록 (최상단 — 가장 중요) */}
        <div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-[14px]">
            {records.map((r) => (
              <div
                key={r.label}
                className={`rounded-2xl p-5 shadow-sm ${
                  r.green ? 'bg-[#F0FDF4] border border-[#BBF7D0]' : 'bg-white'
                }`}
              >
                <p className="text-[11.5px] font-bold text-[#5C5C68]">{r.label}</p>
                <p className="text-2xl font-extrabold tracking-[-0.035em] tabular-nums mt-1 text-[#17171B]">
                  {r.value}
                </p>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-[#9A9AA5] mt-2">
            매치포스트가 기록한 값이에요 — 광고주가 고칠 수 없어요
          </p>
        </div>

        {/* 본문 */}
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-[14px] items-start">
          {/* 좌측 — 받은 평가 */}
          <div className={`${card} flex flex-col`}>
            <h2 className="font-bold text-gray-800 mb-4">받은 평가</h2>
            {reviewList.length > 0 ? (
              <div className="space-y-3 overflow-y-auto">
                {reviewList.map((r, i) => (
                  <div key={i} className="border border-gray-100 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[#F59E0B] text-sm tracking-tight">
                        {'★'.repeat(r.stars ?? 0)}
                        <span className="text-gray-200">{'★'.repeat(5 - (r.stars ?? 0))}</span>
                      </span>
                      <span className="text-xs text-gray-300">{listDateLabel(r.created_at)}</span>
                    </div>
                    {Array.isArray(r.tags) && r.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-1.5">
                        {r.tags.map((t: string) => (
                          <span key={t} className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                    {r.private_note && (
                      <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">
                        {r.private_note}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-400 text-sm text-center py-8">아직 받은 평가가 없어요</p>
            )}
            <p className="text-xs text-gray-400 mt-4 flex-shrink-0">이름은 공개하지 않아요</p>
          </div>

          {/* 우측 (320px) — 직접 작성 값이 있을 때만 렌더 */}
          <div className="flex flex-col gap-[14px]">
            {ap?.marketing_contact_public && (contactEmail || contactPhone) && (
              <div className={card}>
                <h2 className="font-bold text-gray-800 mb-3">마케팅 문의</h2>
                {contactEmail && (
                  <a
                    href={`mailto:${contactEmail}`}
                    className="flex items-center min-h-[44px] text-sm text-[#B45309] hover:underline break-all"
                  >
                    {contactEmail}
                  </a>
                )}
                {contactPhone && (
                  <a
                    href={`tel:${contactPhone}`}
                    className="flex items-center min-h-[44px] text-sm text-[#B45309] hover:underline"
                  >
                    {contactPhone}
                  </a>
                )}
                <p className="text-[11px] text-[#9A9AA5] mt-1">협업 문의 외의 용도로 쓰지 말아주세요</p>
              </div>
            )}

            {ap?.intro && (
              <div className={card}>
                <div className="flex items-center justify-between mb-2">
                  <h2 className="font-bold text-gray-800">소개</h2>
                  {writtenBadge}
                </div>
                <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{ap.intro}</p>
              </div>
            )}

            {ap?.brands && (
              <div className={card}>
                <div className="flex items-center justify-between mb-2">
                  <h2 className="font-bold text-gray-800">함께 일하는 브랜드</h2>
                  {writtenBadge}
                </div>
                <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{ap.brands}</p>
              </div>
            )}

            {ap?.history && (
              <div className={`${card} flex-1`}>
                <div className="flex items-center justify-between mb-2">
                  <h2 className="font-bold text-gray-800">주요 이력</h2>
                  {writtenBadge}
                </div>
                <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{ap.history}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
