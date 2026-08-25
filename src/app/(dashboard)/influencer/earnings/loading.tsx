import { SkelBar, SkelCard } from '@/components/Skeleton'

// D31 2절 — 매출
export default function Loading() {
  return (
    <div className="max-w-lg mx-auto px-4 py-8 [.inf-pc_&]:max-w-none [.inf-pc_&]:px-0 [.inf-pc_&]:py-0">
      <SkelBar w={96} h={19} className="mb-6" />
      <div className="grid grid-cols-2 gap-3 mb-4">
        <SkelCard lines={1} />
        <SkelCard lines={1} />
      </div>
      <div className="flex gap-2 mb-4">
        <SkelBar w={64} h={30} />
        <SkelBar w={64} h={30} />
        <SkelBar w={64} h={30} />
      </div>
      <SkelCard lines={3} />
    </div>
  )
}
