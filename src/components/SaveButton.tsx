'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

// D31 [4] — 저장 버튼의 네 가지 상태를 한 곳에 둔다.
//
//   저장하기 → 저장 중… (회색, 안 눌림) → 저장했어요 ✓ (초록, 2초 뒤 되돌아감)
//                                      → 저장 실패 (빨강, 이유를 아래에 적는다)
//
// 성공 표시를 2초 두는 것이 핵심이다. 즉시 「저장하기」로 돌아가면 아무 일도
// 일어나지 않은 것처럼 보여서, 사람이 눌렀는지 아닌지 모른 채 한 번 더 누른다.
//
// 이유를 버튼 아래에 붙이는 것도 같은 이유다. 화면 맨 위 배너로 띄우면
// 폼이 긴 모바일에서는 누른 사람 눈에 안 들어온다(내 정보 수정이 실제로 그랬다).
//
// 화면마다 따로 만들면 다음 화면에서 또 어긋난다 — 여기 하나만 고친다.

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'failed'

const HOLD_MS = 2000

/**
 * 저장 한 번의 상태를 들고 있는다.
 *
 * run(fn) 의 규약: fn 이 실패 이유(문자열)를 돌려주면 실패, 아무것도 안 돌려주면 성공이다.
 * throw 도 실패로 받는다 — 화면이 「저장했어요」인 채로 남는 일이 없게.
 */
export function useSaveState() {
  const [status, setStatus] = useState<SaveStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clear = () => {
    if (timer.current) {
      clearTimeout(timer.current)
      timer.current = null
    }
  }
  // 화면을 떠난 뒤 setState 가 불리지 않도록
  useEffect(() => clear, [])

  const run = useCallback(async (fn: () => Promise<string | null | void>) => {
    clear()
    setStatus('saving')
    setError(null)
    let reason: string | null = null
    try {
      reason = (await fn()) || null
    } catch {
      reason = '저장하지 못했어요. 잠시 후 다시 시도해주세요.'
    }
    if (reason) {
      setStatus('failed')
      setError(reason)
      return false
    }
    setStatus('saved')
    timer.current = setTimeout(() => setStatus('idle'), HOLD_MS)
    return true
  }, [])

  // 눌러보기도 전에 걸리는 것들(필수값 누락 등)도 같은 자리에 같은 모양으로 보여준다.
  const fail = useCallback((reason: string) => {
    clear()
    setStatus('failed')
    setError(reason)
  }, [])

  const reset = useCallback(() => {
    clear()
    setStatus('idle')
    setError(null)
  }, [])

  return { status, error, run, fail, reset, busy: status === 'saving' }
}

export default function SaveButton({
  status,
  error,
  onClick,
  label = '저장하기',
  savingLabel = '저장 중…',
  savedLabel = '저장했어요 ✓',
  failedLabel = '저장 실패',
  disabled = false,
  disabledHint,
  className = '',
}: {
  status: SaveStatus
  error?: string | null
  onClick: () => void
  label?: string
  savingLabel?: string
  savedLabel?: string
  failedLabel?: string
  /** 바뀐 값이 없거나 필수값이 비었을 때 — 회색으로 두고 누르지 못하게 한다 */
  disabled?: boolean
  /** 왜 못 누르는지 한 줄. 없으면 아무것도 안 쓴다 */
  disabledHint?: string
  className?: string
}) {
  const saving = status === 'saving'
  const off = disabled || saving

  const tone =
    status === 'saved'
      ? 'bg-[#16A34A] text-white'
      : status === 'failed'
        ? 'bg-[#DC2626] text-white hover:bg-[#B91C1C]'
        : off
          ? 'bg-[#D8D8DE] text-white'
          : 'bg-[#F59E0B] text-white hover:bg-[#D97706]'

  const text =
    status === 'saving' ? savingLabel : status === 'saved' ? savedLabel : status === 'failed' ? failedLabel : label

  return (
    <div className={className}>
      <button
        type="button"
        onClick={onClick}
        // 실패했을 때는 눌러야 다시 시도할 수 있으니 막지 않는다.
        disabled={off}
        aria-live="polite"
        title={off && disabledHint ? disabledHint : undefined}
        className={`w-full py-3 rounded-xl font-medium transition ${tone} ${off ? 'cursor-default' : ''}`}
      >
        {text}
      </button>
      {status === 'failed' && error && (
        <p className="mt-2 text-sm text-[#DC2626] leading-relaxed">{error}</p>
      )}
      {status !== 'failed' && off && !saving && disabledHint && (
        <p className="mt-2 text-xs text-[#9A9AA5] text-center">{disabledHint}</p>
      )}
    </div>
  )
}
