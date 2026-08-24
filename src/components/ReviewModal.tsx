'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { creditAmount } from '@/lib/creditConfig'

// 광고주를 평가 (인플루언서가 입력)
const ADV_TAGS = ['결제가 신속해요', '가이드가 명확해요', '요구가 합리적이었어요', '소통이 빨라요', '다시 함께하고 싶어요']
// 인플루언서를 평가 (광고주가 입력)
const INF_TAGS = ['일정을 잘 지켜요', '소통이 빨라요', '콘텐츠 퀄리티가 좋아요', '다시 함께하고 싶어요']

type Props = {
  proposalId: string
  reviewerId: string
  revieweeId: string
  reviewerRole: 'advertiser' | 'influencer'
  revieweeName: string
  onClose: () => void
  onDone: () => void
}

export default function ReviewModal({
  proposalId,
  reviewerId,
  revieweeId,
  reviewerRole,
  revieweeName,
  onClose,
  onDone,
}: Props) {
  const supabase = createClient()
  const [rating, setRating] = useState(0)
  const [hovered, setHovered] = useState(0)
  const [tags, setTags] = useState<string[]>([])
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const tagOptions = reviewerRole === 'advertiser' ? ADV_TAGS : INF_TAGS

  const toggleTag = (tag: string) =>
    setTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]))

  const submit = async () => {
    if (rating === 0) { setError('별점을 선택해주세요'); return }
    setSubmitting(true)
    setError('')
    const { error: err } = await supabase.from('reviews').insert({
      proposal_id: proposalId,
      rater_id: reviewerId,
      ratee_id: revieweeId,
      role: reviewerRole,
      stars: rating,
      tags,
      private_note: comment.trim() || null,
    })
    setSubmitting(false)
    if (err) { setError(err.message); return }
    onDone()
  }

  const STAR_LABELS = ['', '별로예요', '아쉬워요', '괜찮아요', '좋았어요', '최고예요']
  const displayRating = hovered || rating

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[rgba(18,18,24,0.44)] px-4">
      <div className="bg-white rounded-2xl w-full max-w-[460px] overflow-hidden shadow-xl">
        {/* 헤더 */}
        <div className="px-5 pt-5 pb-4 border-b border-[#F1F1F4]">
          <p className="text-[11px] text-[#9A9AA5] mb-0.5">협업 완료</p>
          <p className="text-base font-bold text-[#17171B]">
            <span className="text-amber-500">{revieweeName}</span>님과의 협업은 어떠셨나요?
          </p>
        </div>

        <div className="px-5 py-4 flex flex-col gap-5">
          {/* 별점 */}
          <div className="flex flex-col items-center gap-2">
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((s) => (
                <button
                  key={s}
                  onMouseEnter={() => setHovered(s)}
                  onMouseLeave={() => setHovered(0)}
                  onClick={() => setRating(s)}
                  className="text-3xl transition-transform hover:scale-110"
                >
                  <span style={{ color: s <= displayRating ? '#F59E0B' : '#E5E7EB' }}>★</span>
                </button>
              ))}
            </div>
            <p className="text-sm font-semibold text-[#5C5C68] h-5">
              {displayRating > 0 ? STAR_LABELS[displayRating] : ''}
            </p>
          </div>

          {/* 태그 */}
          <div>
            <p className="text-[11px] font-semibold text-[#9A9AA5] mb-2">어떤 점이 좋았나요? (복수 선택, 3명 이상이 같은 태그를 고르면 프로필에 표시돼요)</p>
            <div className="flex flex-wrap gap-1.5">
              {tagOptions.map((tag) => (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className={`text-[12px] font-medium px-3 py-1.5 rounded-full border transition ${
                    tags.includes(tag)
                      ? 'bg-amber-500 text-white border-amber-500'
                      : 'bg-white text-[#5C5C68] border-[#EAEAEE] hover:border-amber-300'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          {/* 코멘트 */}
          <div>
            <p className="text-[11px] font-semibold text-[#9A9AA5] mb-2">비공개 코멘트 (선택 · 이용자에게만 보여요)</p>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              maxLength={200}
              rows={3}
              placeholder="협업 경험을 자유롭게 남겨주세요"
              className="w-full px-3 py-2.5 text-sm rounded-xl border border-[#EAEAEE] resize-none focus:outline-none focus:border-amber-400 text-[#17171B] placeholder:text-[#C4C4CE]"
            />
            <p className="text-[10px] text-[#C4C4CE] text-right mt-0.5">{comment.length}/200</p>
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <div className="flex flex-col gap-2">
            <button
              onClick={submit}
              disabled={submitting}
              className="w-full py-3 rounded-xl bg-amber-500 text-white font-bold text-sm hover:bg-amber-600 transition disabled:opacity-40 whitespace-nowrap"
            >
              {submitting ? '제출 중...' : `평가 보내고 ${creditAmount('review').toLocaleString()}C 받기`}
            </button>
            <p className="text-[10.5px] text-[#9A9AA5] text-center leading-snug">
              내가 남긴 평가는 상대에게 공개되지 않습니다. 여러 건이 모이면 평균 만 프로필에 표시라요. 제출 이후는 수정할 수 없습니다.
            </p>
            <button
              onClick={onClose}
              className="w-full py-2.5 rounded-xl border border-[#EAEAEE] text-sm text-[#7C7C88] hover:bg-[#F6F6F7] transition"
            >
              나중에 하기
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
