'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { adminCloseReport, adminEscalateReport } from '@/lib/reports/actions'

export default function ReportActions({ reportId }: { reportId: string }) {
  const router = useRouter()
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const close = async () => {
    if (!reason.trim()) { setError('종결 사유를 입력해주세요.'); return }
    setSubmitting(true)
    setError('')
    const res = await adminCloseReport(reportId, reason)
    setSubmitting(false)
    if (!res.ok) { setError(res.error); return }
    router.refresh()
  }

  const escalate = async () => {
    setSubmitting(true)
    setError('')
    const res = await adminEscalateReport(reportId)
    setSubmitting(false)
    if (!res.ok) { setError(res.error); return }
    router.refresh()
  }

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm flex flex-col gap-3">
      <p className="font-semibold text-gray-800">처리</p>
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={2}
        placeholder="종결 사유 (종결 시 필수)"
        className="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-200 resize-none focus:outline-none focus:border-amber-400"
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={escalate}
          disabled={submitting}
          className="py-2.5 rounded-lg text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 transition disabled:opacity-40"
        >
          외부 이관
        </button>
        <button
          onClick={close}
          disabled={submitting}
          className="py-2.5 rounded-lg text-sm font-medium bg-[#F59E0B] text-white hover:bg-[#D97706] transition disabled:opacity-40"
        >
          종결
        </button>
      </div>
    </div>
  )
}
