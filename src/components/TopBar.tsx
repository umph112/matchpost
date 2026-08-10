import Link from 'next/link'
import { Settings } from 'lucide-react'
import Logo from './Logo'

// 앱 공통 상단바(모바일 폭 페이지용): 왼쪽 로고 / 오른쪽 활동명 + 설정
export default function TopBar({
  name,
  homeHref = '/influencer/dashboard',
  editHref = '/influencer/profile',
}: {
  name?: string
  homeHref?: string
  editHref?: string
}) {
  return (
    <nav className="bg-white border-b border-gray-100 sticky top-0 z-40">
      <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
        <Link href={homeHref}>
          <Logo size={14} />
        </Link>
        <Link href={editHref} className="flex items-center gap-2 text-gray-600 hover:text-[#B45309]">
          <span className="text-sm font-medium max-w-[120px] truncate">{name}</span>
          <span className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-gray-500" title="내 정보 수정">
            <Settings size={16} strokeWidth={1.75} />
          </span>
        </Link>
      </div>
    </nav>
  )
}
