import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import ReportActions from '@/components/admin/ReportActions'

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

export default async function AdminReportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/login')

  const { data: report } = await supabase
    .from('reports')
    .select(`
      id, type, body, status, stage, snapshot, close_reason, closed_at, created_at,
      reporter:profiles!reports_reporter_id_fkey(id, name),
      counterpart:profiles!reports_counterpart_id_fkey(id, name)
    `)
    .eq('id', id)
    .single()

  if (!report) notFound()

  const r = report as any

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center mb-8">
        <Link href="/admin/reports" className="mr-4 text-gray-400 hover:text-gray-600">
          신고 목록
        </Link>
        <h1 className="text-xl font-bold text-gray-900">신고 상세</h1>
        {/* 제재는 사이드바에 두지 않는다 — 신고 판정의 결과라 여기서만 들어간다 */}
        <Link
          href="/admin/sanctions"
          className="ml-auto text-sm font-medium text-[#B45309] hover:underline"
        >
          이용 제한 단계 →
        </Link>
      </div>

      <div className="bg-white rounded-2xl p-5 shadow-sm mb-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs px-2 py-1 rounded-full font-medium bg-gray-100 text-gray-600">{r.status}</span>
          <span className="text-xs text-gray-400">{new Date(r.created_at).toLocaleString('ko-KR')}</span>
        </div>
        <p className="font-bold text-gray-800 text-lg">{TYPE_LABELS[r.type] ?? r.type}</p>
        <p className="text-sm text-gray-500 mt-1">
          신고자 {r.reporter?.name ?? '알 수 없음'} → 피신고자 {r.counterpart?.name ?? '알 수 없음'}
          {r.stage && ` · 접수 시점 단계: ${r.stage}`}
        </p>
        <p className="text-sm text-gray-700 mt-4 whitespace-pre-wrap">{r.body}</p>
      </div>

      {r.snapshot && (
        <div className="bg-white rounded-2xl p-5 shadow-sm mb-4">
          <p className="font-semibold text-gray-800 mb-2">접수 시점 스냅샷</p>
          <pre className="text-xs text-gray-500 bg-gray-50 rounded-lg p-3 overflow-x-auto">
            {JSON.stringify(r.snapshot, null, 2)}
          </pre>
        </div>
      )}

      {r.close_reason && (
        <div className="bg-white rounded-2xl p-5 shadow-sm mb-4">
          <p className="font-semibold text-gray-800 mb-1">종결 사유</p>
          <p className="text-sm text-gray-600">{r.close_reason}</p>
          {r.closed_at && (
            <p className="text-xs text-gray-400 mt-1">{new Date(r.closed_at).toLocaleString('ko-KR')}</p>
          )}
        </div>
      )}

      {r.status === 'open' && <ReportActions reportId={r.id} />}
    </div>
  )
}
