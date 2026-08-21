import { createServiceClient } from '@/lib/supabase/service'
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'

// 채널별 콘텐츠 단위 (수량 표시용). campaigns/new 의 CHANNEL_UNIT 과 동일 의미.
const CHANNEL_UNIT: Record<string, string> = { 블로그: '포스트', 유튜브: '영상', 인스타그램: '피드', 틱톡: '피드' }

function ymd(s: string | null | undefined): string {
  if (!s) return ''
  return s.slice(0, 10).replace(/-/g, '.')
}

function rangeLabel(a: string | null | undefined, b: string | null | undefined): string | null {
  if (!a && !b) return null
  if (a && b) return `${ymd(a)} ~ ${ymd(b)}`
  return ymd(a || b)
}

// 검색 결과 카드/미리보기용 메타데이터. 페이지 본문과 같은 화이트리스트 원칙으로 공개 필드만 읽는다.
// 공개 캠페인만 index=true, 비공개·미존재는 noindex 로 검색에서 뺀다.
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const db = createServiceClient()
  const { data: c } = await db
    .from('campaigns')
    .select(
      'title, brand_name, campaign_type, location_city, location_district, recruit_target, details, cover_image_url, image_urls, is_public, advertiser_id'
    )
    .eq('id', id)
    .single()

  if (!c || !c.is_public) return { title: '캠페인', robots: { index: false, follow: false } }

  let brand = (c.brand_name as string | null)?.trim() || ''
  if (!brand) {
    const { data: ap } = await db
      .from('advertiser_profiles')
      .select('company_name')
      .eq('user_id', c.advertiser_id)
      .maybeSingle()
    brand = ap?.company_name || ''
  }

  const region = [c.location_city, c.location_district].filter(Boolean).join(' ')
  const title = brand ? `${brand} · ${c.title}` : (c.title as string)
  const bits = [c.campaign_type, region, c.recruit_target ? `${c.recruit_target}명 모집` : '']
    .filter(Boolean)
    .join(' · ')
  const details = (c.details as string | null)?.replace(/\s+/g, ' ').trim() || ''
  const description =
    (bits ? `${bits}. ` : '') +
    (details ? details.slice(0, 100) : '매치포스트에서 협업할 인플루언서를 모집합니다.')
  const cover =
    (c.cover_image_url as string | null) ||
    (Array.isArray(c.image_urls) && c.image_urls.length > 0 ? (c.image_urls[0] as string) : null)
  const canonical = `/campaigns/${id}`

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      type: 'article',
      images: cover ? [cover] : undefined,
    },
    robots: { index: true, follow: true },
  }
}

// 캠페인 공개 페이지 — 로그인 없이 열리는 검색 노출용 URL.
// 원칙(D22 A-0): 검색엔진이 보는 것 = 비회원이 보는 것. 같은 페이지가 로그인 여부로 CTA만 바꾼다.
// campaigns 는 anon RLS 로 막혀 있어 advertiser/[id]·profile/[id] 와 동일하게 서비스 롤로 읽되,
// 공개 컬럼만 화이트리스트로 select 하고 예산·옵션·결제조건·참여자(proposals)·딜시트·대화는 조회조차 하지 않는다.
export default async function CampaignPublicPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const db = createServiceClient()

  const { data: c } = await db
    .from('campaigns')
    .select(
      'id, title, brand_name, campaign_type, channels, content_counts, recruit_target, recruit_start, recruit_end, announce_date, content_start, content_end, location_city, location_district, predefined_categories, free_tags, details, cover_image_url, image_urls, dates, status, is_public, advertiser_id'
    )
    .eq('id', id)
    .single()

  // 공개 설정이 꺼졌거나 없는 캠페인은 검색에도, 비회원에게도 열리지 않는다
  if (!c || !c.is_public) notFound()

  // 브랜드명 폴백 — brand_name 비면 광고주 상호(company_name), 그것도 없으면 계정 이름
  let brand = (c.brand_name as string | null)?.trim() || ''
  if (!brand) {
    const { data: ap } = await db
      .from('advertiser_profiles')
      .select('company_name')
      .eq('user_id', c.advertiser_id)
      .maybeSingle()
    brand = ap?.company_name || ''
    if (!brand) {
      const { data: p } = await db.from('profiles').select('name').eq('id', c.advertiser_id).maybeSingle()
      brand = p?.name || '광고주'
    }
  }

  // 로그인 여부만 확인 — 데이터는 위에서 서비스 롤로 이미 읽었고, 여기선 CTA 분기에만 쓴다
  const {
    data: { user },
  } = await (await createClient()).auth.getUser()

  const ended = c.status !== 'open'
  const cover =
    (c.cover_image_url as string | null) ||
    (Array.isArray(c.image_urls) && c.image_urls.length > 0 ? (c.image_urls[0] as string) : null)
  const channels: string[] = Array.isArray(c.channels) ? c.channels : []
  const counts = (c.content_counts as Record<string, number> | null) ?? {}
  const region = [c.location_city, c.location_district].filter(Boolean).join(' ')
  const tags: string[] = [
    ...(Array.isArray(c.predefined_categories) ? c.predefined_categories : []),
    ...(Array.isArray(c.free_tags) ? c.free_tags : []),
  ]
  const dates: { date?: string }[] = Array.isArray(c.dates) ? c.dates : []

  const rows: { label: string; value: string }[] = []
  if (c.recruit_target) rows.push({ label: '모집 인원', value: `${c.recruit_target}명` })
  const recruit = rangeLabel(c.recruit_start, c.recruit_end)
  if (recruit) rows.push({ label: '모집 기간', value: recruit })
  if (c.announce_date) rows.push({ label: '발표', value: ymd(c.announce_date) })
  const content = rangeLabel(c.content_start, c.content_end)
  if (content) rows.push({ label: '콘텐츠 게재', value: content })
  const dateList = dates.map((d) => ymd(d.date)).filter(Boolean)
  if (dateList.length > 0) rows.push({ label: '진행일', value: dateList.join(', ') })

  const card = 'bg-white rounded-2xl p-5 shadow-sm'

  return (
    <div className="min-h-screen bg-[#FAFAFB] py-8 px-4 pb-28">
      <div className="max-w-[720px] mx-auto flex flex-col gap-[14px]">
        {ended && (
          <div className="bg-[#F3F4F6] text-[#5C5C68] rounded-xl px-4 py-3 text-[13px]">
            이 캠페인은 모집이 마감되었어요.{' '}
            <Link href="/" className="font-bold text-[#B45309] hover:underline">
              진행 중인 캠페인 보기 →
            </Link>
          </div>
        )}

        {cover && (
          <div className="w-full rounded-2xl overflow-hidden bg-[#ECECEF] aspect-[16/9]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={cover} alt={(c.title as string) || '캠페인 대표 이미지'} className="w-full h-full object-cover" />
          </div>
        )}

        {/* 머리 */}
        <div>
          {brand && <p className="text-[13px] font-bold text-[#B45309]">{brand}</p>}
          <h1 className="text-[26px] font-extrabold text-[#17171B] tracking-[-0.035em] mt-0.5 leading-tight">
            {c.title}
          </h1>
          <div className="flex items-center gap-[6px] flex-wrap mt-2.5">
            {c.campaign_type && (
              <span className="text-xs font-semibold text-[#5C5C68] bg-[#F1F1F4] px-2 py-0.5 rounded-full">
                {c.campaign_type}
              </span>
            )}
            {region && (
              <span className="text-xs font-semibold text-[#5C5C68] bg-[#F1F1F4] px-2 py-0.5 rounded-full">
                📍 {region}
              </span>
            )}
            {channels.map((ch) => (
              <span
                key={ch}
                className="text-xs font-semibold text-[#3730A3] bg-[#EEF2FF] px-2 py-0.5 rounded-full"
              >
                {ch}
                {counts[ch] ? ` ${counts[ch]}${CHANNEL_UNIT[ch] ?? '개'}` : ''}
              </span>
            ))}
          </div>
        </div>

        {/* 모집 정보 */}
        {rows.length > 0 && (
          <div className={card}>
            <div className="flex flex-col gap-2.5">
              {rows.map((r) => (
                <div key={r.label} className="flex items-start justify-between gap-3">
                  <span className="text-[13px] text-[#9A9AA5] shrink-0">{r.label}</span>
                  <span className="text-[13px] font-semibold text-[#17171B] text-right tabular-nums">
                    {r.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 미션 요약 (설명) */}
        {c.details && (
          <div className={card}>
            <h2 className="font-bold text-[#17171B] mb-2">미션 안내</h2>
            <p className="text-sm text-[#5C5C68] leading-relaxed whitespace-pre-wrap">{c.details}</p>
          </div>
        )}

        {/* 분야 태그 */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {tags.map((t) => (
              <span key={t} className="text-xs text-[#5C5C68] bg-[#F1F1F4] px-2 py-0.5 rounded-full">
                #{t}
              </span>
            ))}
          </div>
        )}

        <p className="text-[11px] text-[#9A9AA5] mt-1">
          참여자·페이·상세 협의 조건은 참여한 인플루언서에게만 보여요.
        </p>
      </div>

      {/* CTA — 같은 페이지가 로그인 여부로 행동만 바꾼다 */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur border-t border-[#EEE] px-4 py-3">
        <div className="max-w-[720px] mx-auto">
          {ended ? (
            <Link
              href="/"
              className="flex items-center justify-center min-h-[48px] w-full rounded-xl bg-[#17171B] text-white text-[15px] font-bold"
            >
              진행 중인 캠페인 보기
            </Link>
          ) : user ? (
            <Link
              href="/"
              className="flex items-center justify-center min-h-[48px] w-full rounded-xl bg-[#F59E0B] hover:bg-[#D97706] text-white text-[15px] font-bold transition"
            >
              매치포스트에서 열기
            </Link>
          ) : (
            <Link
              href="/login"
              className="flex items-center justify-center min-h-[48px] w-full rounded-xl bg-[#F59E0B] hover:bg-[#D97706] text-white text-[15px] font-bold transition"
            >
              로그인하고 참여하기
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
