'use client'

import { usePathname } from 'next/navigation'

// D7 3-1 — 대화 목록(list) + 대화창(children)을 PC에서는 항상 2단으로, 모바일에서는
// 라우트에 따라 한쪽만 보여준다. list=이 라우트 그룹의 layout.tsx에서 만든 목록,
// children=현재 페이지(빈 상태 또는 [id] 대화방). basePath와 pathname이 같으면(=/messages)
// 목록만, 하위 경로(=/messages/xxxxx)면 대화방만 — PC에서는 두 클래스 세트를 그대로 두고
// Tailwind가 정적으로 인식할 수 있게 pcClass별 분기를 리터럴 클래스로 나눈다(동적 템플릿 금지 —
// Tailwind는 런타임 문자열 조합을 감지하지 못한다).
const WRAP_PC_CLASS = {
  'adv-pc': '[.adv-pc_&]:h-[calc(100vh-96px)] [.adv-pc_&]:border [.adv-pc_&]:border-[#EAEAEE] [.adv-pc_&]:rounded-[14px] [.adv-pc_&]:overflow-hidden [.adv-pc_&]:bg-white',
  'inf-pc': '[.inf-pc_&]:h-[calc(100vh-96px)] [.inf-pc_&]:border [.inf-pc_&]:border-[#EAEAEE] [.inf-pc_&]:rounded-[14px] [.inf-pc_&]:overflow-hidden [.inf-pc_&]:bg-white',
}
const LIST_PC_CLASS = {
  'adv-pc': '[.adv-pc_&]:w-[320px] [.adv-pc_&]:shrink-0 [.adv-pc_&]:border-r [.adv-pc_&]:border-[#EAEAEE]',
  'inf-pc': '[.inf-pc_&]:w-[320px] [.inf-pc_&]:shrink-0 [.inf-pc_&]:border-r [.inf-pc_&]:border-[#EAEAEE]',
}
const LIST_SHOW_ON_PC = {
  'adv-pc': '[.adv-pc_&]:block',
  'inf-pc': '[.inf-pc_&]:block',
}
const ROOM_SHOW_ON_PC = {
  'adv-pc': '[.adv-pc_&]:flex',
  'inf-pc': '[.inf-pc_&]:flex',
}

export default function MessagesSplit({
  basePath,
  pcClass,
  list,
  children,
}: {
  basePath: string
  pcClass: 'adv-pc' | 'inf-pc'
  list: React.ReactNode
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const hasRoom = pathname !== basePath

  return (
    <div className={`flex flex-1 min-h-0 gap-0 ${WRAP_PC_CLASS[pcClass]}`}>
      <div className={`w-full overflow-y-auto ${LIST_PC_CLASS[pcClass]} ${hasRoom ? `hidden ${LIST_SHOW_ON_PC[pcClass]}` : 'block'}`}>
        {list}
      </div>
      <div className={`flex-1 min-w-0 flex-col ${hasRoom ? 'flex' : `hidden ${ROOM_SHOW_ON_PC[pcClass]}`}`}>
        {children}
      </div>
    </div>
  )
}
