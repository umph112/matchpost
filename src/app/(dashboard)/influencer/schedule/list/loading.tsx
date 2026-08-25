import { SkelBar, SkelCard } from '@/components/Skeleton'

// D31 2절 — 오픈(내 일정)
export default function Loading() {
  return (
    <div className="max-w-lg mx-auto px-4 py-8 [.inf-pc_&]:max-w-none [.inf-pc_&]:px-0 [.inf-pc_&]:py-0">
      <div className="flex items-center justify-between mb-8">
        <SkelBar w={96} h={19} />
        <SkelBar w={88} h={34} />
      </div>
      <div className="space-y-3">
        <SkelCard lines={2} />
        <SkelCard lines={2} />
        <SkelCard lines={1} />
      </div>
    </div>
  )
}
