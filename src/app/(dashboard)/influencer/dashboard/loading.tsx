import { SkelBar, SkelCard, SkelRow } from '@/components/Skeleton'

// D31 2절 — 홈. 셸(상단바·하단 탭)은 레이아웃이라 그대로 남고 이 자리만 골격이 된다.
export default function Loading() {
  return (
    <>
      <div className="bg-white rounded-2xl p-4 shadow-sm flex items-center gap-3">
        <div className="w-14 h-14 rounded-full bg-[#EDEDF1] animate-pulse shrink-0" />
        <div className="flex-1 min-w-0 space-y-2">
          <SkelBar w="46%" h={14} />
          <SkelBar w={72} h={16} />
        </div>
      </div>
      <SkelCard lines={2} />
      <SkelRow />
      <SkelRow />
    </>
  )
}
