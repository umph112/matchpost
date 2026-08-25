import { SkelBar, SkelRow } from '@/components/Skeleton'

// D31 2절 — 인플루언서 공통 골격.
//
// 왜 여기에도 두나. loading.tsx 는 「그 폴더의 layout 아래」를 감싼다.
// 그래서 화면별 loading.tsx 는 그 화면의 page 만 받쳐준다 —
// 대시(/influencer/messages)처럼 layout 이 무거운 곳은 그 위에 경계가 있어야 한다.
// 이 파일이 그 경계다. 탭을 옮길 때 셸(상단바·하단 탭)은 그대로 남고 이 자리만 골격이 된다.
//
// 화면별 골격이 있는 곳에서는 이 파일이 뜨지 않는다 — 탭 사이 이동은 이 폴더의 layout 을
// 다시 그리지 않으므로 여기 경계는 걸리지 않고, 더 안쪽 경계가 먼저 잡는다.
export default function Loading() {
  return (
    <div className="flex-1 space-y-3">
      <SkelBar w={72} h={18} className="mb-1" />
      <SkelRow />
      <SkelRow />
      <SkelRow />
    </div>
  )
}
