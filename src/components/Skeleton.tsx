// D31 2절 — 탭을 눌렀을 때 흰 화면 대신 내보낼 골격.
//
// 서버는 8~18ms 로 빠르다. 3초는 브라우저로 내려보내는 짐(JS 742KB)과
// 화면마다 클라이언트에서 데이터를 가져오는 시간이다. 그 전에는 아무것도 안 그려졌다.
// 골격은 그 시간을 줄이지 않는다 — 「먹었나?」를 없앨 뿐이다. 그것만으로 체감이 다르다.
//
// 모양만 맞으면 된다. 진짜 화면과 칸 수·높이를 억지로 맞추려 들면
// 화면이 바뀔 때마다 여기도 같이 고쳐야 하고, 결국 안 고쳐서 어긋난다.

export function SkelBar({ w = '100%', h = 12, className = '' }: { w?: string | number; h?: number; className?: string }) {
  return <div className={`bg-[#EDEDF1] rounded-md animate-pulse ${className}`} style={{ width: w, height: h }} />
}

export function SkelCard({ lines = 2, className = '' }: { lines?: number; className?: string }) {
  return (
    <div className={`bg-white rounded-2xl shadow-sm p-4 space-y-2.5 ${className}`}>
      <SkelBar w="42%" h={14} />
      {Array.from({ length: lines }).map((_, i) => (
        <SkelBar key={i} w={i === lines - 1 ? '64%' : '88%'} h={11} />
      ))}
    </div>
  )
}

export function SkelRow({ className = '' }: { className?: string }) {
  return (
    <div className={`bg-white rounded-2xl shadow-sm p-4 flex items-center gap-3 ${className}`}>
      <div className="w-11 h-11 rounded-full bg-[#EDEDF1] animate-pulse shrink-0" />
      <div className="flex-1 min-w-0 space-y-2">
        <SkelBar w="38%" h={12} />
        <SkelBar w="72%" h={10} />
      </div>
    </div>
  )
}

/** 화면 맨 위 제목 줄 — 「매출 관리」처럼 h1 이 있는 화면용 */
export function SkelTitle() {
  return <SkelBar w={112} h={19} className="mb-2" />
}
