import { SkelBar, SkelCard } from '@/components/Skeleton'

// D31 2절 — 캠페인 찾기
export default function Loading() {
  return (
    <div className="max-w-lg mx-auto px-4 py-8 [.inf-pc_&]:max-w-none [.inf-pc_&]:px-0 [.inf-pc_&]:py-0">
      <SkelBar w={112} h={19} className="mb-8" />
      <div className="bg-white rounded-2xl shadow-sm p-4 space-y-3 mb-4">
        <SkelBar w="100%" h={38} />
        <SkelBar w="100%" h={38} />
        <SkelBar w="100%" h={40} />
      </div>
      <SkelCard lines={2} />
    </div>
  )
}
