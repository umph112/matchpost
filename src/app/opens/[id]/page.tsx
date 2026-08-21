import { createServiceClient } from '@/lib/supabase/service'
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'

function ymd(s: string | null | undefined): string {
  if (!s) return ''
  return s.slice(0, 10).replace(/-/g, '.')
}

function rangeLabel(a: string | null | undefined, b: string | null | undefined): string | null {
  if (!a && !b) return null
  if (a && b && ymd(a) !== ymd(b)) return `${ymd(a)} ~ ${ymd(b)}`
  return ymd(a || b)
}

// 검색 결과 카드/미리보기용 메타데이터. 신원 정보(이름·채널 URL·연락처)는 여기서도 읽지 않는다.
// seo_public && is_public 이고 지나지 않은 오픈만 index=true. 마감·비공개는 noindex.
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const db = createServiceClient()
  const { data: o } = await db
    .from('schedules')
    .select('title, date, date_end, location_city, location_district, channels, fee, is_public, seo_public, status')
    .eq('id', id)
    .single()

  if (!o || !o.seo_public || !o.is_public) return { title: '오픈', robots: { index: false, follow: false } }

  const today = new Date().toISOString().slice(0, 10)
  const lastDay = (o.date_end as string | null) || (o.date as string | null)
  const ended = o.status !== 'open' || (!!lastDay && lastDay < today)

  const region = [o.location_city, o.location_district].filter(Boolean).join(' ')
  const dateLabel = (o.date as string | null)?.slice(0, 10).replace(/-/g, '.') || ''
  const channels = Array.isArray(o.channels) ? (o.channels as string[]).join('·') : ''
  const fee = (o.fee as string | null)?.trim() || ''
  const title = ([region, dateLabel].filter(Boolean).join(' ') + ' 인플루언서 오픈').trim()
  const description =
    [dateLabel, region, channels, fee ? `희망 페이 ${fee}` : ''].filter(Boolean).join(' · ') ||
    '매치포스트 인플루언서 오픈'
  const canonical = `/opens/${id}`

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { title, description, url: canonical, type: 'article' },
    // 마감된 오픈은 색인하지 않는다(지난 오픈이 검색에 뜨면 죽은 서비스처럼 보임). 페이지 자체는 살려둔다.
    robots: ended ? { index: false, follow: true } : { index: true, follow: true },
  }
}

// 오픈 공개 페이지 — 인플루언서가 「검색 노출」을 켠 일정만 열리는 검색용 URL.
// 원칙(D22 A-0): 검색엔진이 보는 것 = 비회원이 보는 것. 같은 페이지가 로그인 여부로 CTA만 바꾼다.
// schedules 는 anon RLS 로 막혀 있어 서비스 롤로 읽되, 공개 컬럼만 화이트리스트로 select 한다.
// 인플루언서 이름·채널 URL·프로필·연락처는 profiles/influencer_profiles 에 있고, 여기선 조인조차 하지 않는다.
export default async function OpenPublicPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const db = createServiceClient()

  const { data: o } = await db
    .from('schedules')
    .select(
      'id, title, date, date_end, location_city, location_district, predefined_categories, free_tags, channels, fee, is_public, seo_public, status'
    )
    .eq('id', id)
    .single()

  // 검색 노출을 켠(seo_public) + 광고주에게도 공개(is_public)인 오픈만 열린다. 아니면 검색에도 안 나온다.
  if (!o || !o.seo_public || !o.is_public) notFound()

  // 로그인 여부만 확인 — CTA 분기에만 쓴다
  const {
    data: { user },
  } = await (await createClient()).auth.getUser()

  // 지난 날짜(또는 종료 상태)면 "마감" 안내. 페이지는 살려둔다(죽은 링크 방지).
  const today = new Date().toISOString().slice(0, 10)
  const lastDay = (o.date_end as string | null) || (o.date as string | null)
  const ended = o.status !== 'open' || (!!lastDay && lastDay < today)

  const region = [o.location_city, o.location_district].filter(Boolean).join(' ')
  const channels: string[] = Array.isArray(o.channels) ? o.channels : []
  const tags: string[] = [
    ...(Array.isArray(o.predefined_categories) ? o.predefined_categories : []),
    ...(Array.isArray(o.free_tags) ? o.free_tags : []),
  ]
  const dateLabel = rangeLabel(o.date, o.date_end)
  const fee = (o.fee as string | null)?.trim() || ''

  const rows: { label: string; value: string }[] = []
  if (dateLabel) rows.push({ label: '날짜', value: dateLabel })
  if (region) rows.push({ label: '지역', value: region })
  if (fee) rows.push({ label: '희망 페이', value: fee })

  const card = 'bg-white rounded-2xl p-5 shadow-sm'

  return (
    <div className="min-h-screen bg-[#FAFAFB] py-8 px-4 pb-28">
      <div className="max-w-[720px] mx-auto flex flex-col gap-[14px]">
        {ended && (
          <div className="bg-[#F3F4F6] text-[#5C5C68] rounded-xl px-4 py-3 text-[13px]">
            이 오픈은 마감되었어요.{' '}
            <Link href="/" className="font-bold text-[#B45309] hover:underline">
              진행 중인 오픈 보기 →
            </Link>
          </div>
        )}

        {/* 머리 */}
        <div>
          <p className="text-[13px] font-bold text-[#B45309]">인플루언서 오픈</p>
          <h1 className="text-[26px] font-extrabold text-[#17171B] tracking-[-0.035em] mt-0.5 leading-tight">
            {o.title}
          </h1>
          <div className="flex items-center gap-[6px] flex-wrap mt-2.5">
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
              </span>
            ))}
          </div>
        </div>

        {/* 오픈 정보 */}
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
          이름·채널 주소·연락처는 로그인한 사람에게만 보여요.
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
              진행 중인 오픈 보기
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
              로그인하고 연락하기
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
