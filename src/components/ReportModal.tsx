'use client'

import { useState } from 'react'
import { fileReport } from '@/lib/reports/actions'
// 타입은 'use server' 파일에서 못 가져온다 — ./types 주석 참고
import type { ReportType } from '@/lib/reports/types'

const TYPE_LABELS: Record<ReportType, string> = {
  unpaid: '대금 미지급',
  cancel_unilateral: '일방적 취소·조건 변경',
  guide_mismatch_req: '가이드와 다른 요구',
  draft_late: '원고 미제출·게재 지연',
  guide_violation: '가이드 불이행',
  no_show: '무단 불참',
  abuse: '욕설·부적절한 요구',
  etc: '기타',
}

// D6 E4 — 신고 유형은 관리자 REPORT_TYPES를 역할별로 잘라 쓴다(입구는 대화 헤더 한 곳뿐)
const ADVERTISER_TYPES: ReportType[] = ['draft_late', 'guide_violation', 'no_show', 'abuse', 'etc']
const INFLUENCER_TYPES: ReportType[] = ['unpaid', 'cancel_unilateral', 'guide_mismatch_req', 'abuse', 'etc']

export default function ReportModal({
  proposalId,
  role,
  onClose,
  onDone,
}: {
  proposalId: string
  role: 'advertiser' | 'influencer'
  onClose: () => void
  onDone: () => void
}) {
  const [type, setType] = useState<ReportType | ''>('')
  const [body, setBody] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const types = role === 'advertiser' ? ADVERTISER_TYPES : INFLUENCER_TYPES

  const submit = async () => {
    if (!type) { setError('신고 유형을 선택해주세요.'); return }
    if (!body.trim()) { setError('내용을 입력해주세요.'); return }
    setSubmitting(true)
    setError('')
    const res = await fileReport('proposal', proposalId, type, body)
    setSubmitting(false)
    if (!res.ok) { setError(res.error); return }
    onDone()
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[rgba(23,23,27,0.42)] px-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl w-full max-w-[440px] overflow-hidden shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 pt-5 pb-4 border-b border-[#F1F1F4]">
          <p className="text-[11px] text-[#9A9AA5] mb-0.5">운영팀에 알리기</p>
          <p className="text-base font-bold text-[#17171B]">무슨 일이 있었나요?</p>
          <p className="text-[11.5px] text-[#7C7C88] mt-1 leading-relaxed">
            매치포스트는 판정하지 않습니다 — 양쪽 기록을 확인하고 안내합니다. 접수되면 상대에게도
            같은 내용이 전달되고, 처리 결과는 알림함으로 보내드립니다. 더 하실 말씀은 고객센터로 남겨주세요.
          </p>
        </div>

        <div className="px-5 py-4 flex flex-col gap-4">
          <div>
            <p className="text-[11px] font-semibold text-[#9A9AA5] mb-2">유형</p>
            <div className="flex flex-wrap gap-1.5">
              {types.map((t) => (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  className={`text-[12px] font-medium px-3 py-1.5 rounded-full border transition ${
                    type === t
                      ? 'bg-red-600 text-white border-red-600'
                      : 'bg-white text-[#5C5C68] border-[#EAEAEE] hover:border-red-300'
                  }`}
                >
                  {TYPE_LABELS[t]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[11px] font-semibold text-[#9A9AA5] mb-2">상황 설명</p>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={1000}
              rows={4}
              placeholder="언제, 무슨 일이 있었는지 적어주세요"
              className="w-full px-3 py-2.5 text-sm rounded-xl border border-[#EAEAEE] resize-none focus:outline-none focus:border-red-400 text-[#17171B] placeholder:text-[#C4C4CE]"
            />
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <div className="flex flex-col gap-2">
            <button
              onClick={submit}
              disabled={submitting}
              className="w-full py-3 rounded-xl bg-red-600 text-white font-bold text-sm hover:bg-red-700 transition disabled:opacity-40"
            >
              {submitting ? '접수 중...' : '운영팀에 알리기'}
            </button>
            <button
              onClick={onClose}
              className="w-full py-2.5 rounded-xl border border-[#EAEAEE] text-sm text-[#7C7C88] hover:bg-[#F6F6F7] transition"
            >
              닫기
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
