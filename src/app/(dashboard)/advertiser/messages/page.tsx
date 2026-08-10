import { MessageSquare } from 'lucide-react'

// D7 3-1 — 목록은 layout.tsx가 그린다. 여기는 아무 대화도 선택하지 않았을 때의 오른쪽 빈 상태.
export default function AdvertiserMessagesEmptyPage() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-16">
      <MessageSquare size={32} strokeWidth={1.5} className="text-gray-300 mb-3" />
      <p className="text-gray-400 text-sm">왼쪽에서 대화를 골라주세요</p>
    </div>
  )
}
