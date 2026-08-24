import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { listTime } from '@/lib/date'

const TYPE_LABELS: Record<string, string> = {
  unpaid: '대금 미지급',
  cancel_unilateral: '일방적 취소·조건 변경',
  guide_mismatch_req: '가이드와 다른 요구',
  draft_late: '원고 미제출·게재 지연',
  guide_violation: '가이드 불이행',
  no_show: '무단 불참',
  abuse: '욕설·부적절한 요구',
  etc: '기타',
}

const STATUS_STYLE: Record<string, string> = {
  open: 'bg-[#FEE2E2] text-[#DC2626]',
  resolved: 'bg-[#DCFCE7] text-[#15803D]',
  closed: 'bg-gray-100 text-gray-500',
  escalated: 'bg-[#FEF3C7] text-[#B45309]',
}

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const { status } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/login')

  let query = supabase
    .from('reports')
    .select(`
      id, type, status, stage, created_at, closed_at,
      reporter:profiles!reports_reporter_id_fkey(name),
      counterpart:profiles!reports_counterpart_id_fkey(name)
    `)
    .order('created_at', { ascending: false })
    .limit(100)

  if (status) query = query.eq('status', status)

  const { data: reports } = await query

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center mb-8">
        <h1 className="text-xl font-bold text-gray-900">신고 관리</h1>
        <Link
          href="/admin/sanctions"
          className="ml-auto text-sm font-medium text-[#B45309] hover:underline"
        >
          이용 제한 단계 →
        </Link>
      </div>

      <div className="flex gap-2 mb-6 overflow-x-auto">
        {[
          { label: '처리 대기', value: 'open' },
          { label: '해결됨', value: 'resolved' },
          { label: '종결됨', value: 'closed' },
          { label: '이관됨', value: 'escalated' },
          { label: '전체', value: '' },
        ].map((f) => (
          <Link
            key={f.value}
            href={f.value ? `/admin/reports?status=${f.value}` : '/admin/reports'}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition ${
              (status ?? '') === f.value ? 'bg-[#F59E0B] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {(!reports || reports.length === 0) && (
        <div className="text-center py-16">
          <p className="text-gray-400">해당하는 신고가 없어요</p>
        </div>
      )}

      <div className="space-y-3">
        {reports?.map((r: any) => (
          <Link
            key={r.id}
            href={`/admin/reports/${r.id}`}
            className="block bg-white rounded-2xl p-5 shadow-sm hover:shadow-md transition"
          >
            <div className="flex items-center justify-between mb-2">
              <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_STYLE[r.status] ?? ''}`}>
                {r.status}
              </span>
              <span className="text-xs text-gray-400">
                {listTime(r.created_at)}
              </span>
            </div>
            <p className="font-semibold text-gray-800">{TYPE_LABELS[r.type] ?? r.type}</p>
            <p className="text-xs text-gray-400 mt-1">
              {r.reporter?.name ?? '알 수 없음'} → {r.counterpart?.name ?? '알 수 없음'}
              {r.stage && ` · ${r.stage} 단계`}
            </p>
          </Link>
        ))}
      </div>
    </div>
  )
}
