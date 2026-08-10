import { Hourglass } from 'lucide-react'
import Logo from '@/components/Logo'

export default function PendingPage() {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-8 text-center max-w-[420px]">
      <div className="flex justify-center mb-8"><Logo size={20} /></div>

      <Hourglass size={40} strokeWidth={1.5} className="mx-auto mb-6 text-[#F59E0B]" />

      <h2 className="text-xl font-bold text-gray-800 mb-3">
        가입 승인 대기 중이에요
      </h2>
      <p className="text-gray-500 text-sm leading-relaxed mb-6">
        회원가입 신청이 완료됐어요.<br />
        관리자가 서류를 확인한 후 승인하면<br />
        이메일로 알려드릴게요.
      </p>

      <div className="bg-[#FEF3C7] rounded-lg p-4 text-left text-sm text-[#B45309]">
        <p className="font-medium mb-2">승인 절차 안내</p>
        <p>1. 관리자에게 증빙서류 제출</p>
        <p>2. 서류 검토 (1~3 영업일) · 확인 즉시 서류는 삭제됩니다</p>
        <p>3. 승인 완료 이메일 수신</p>
        <p>4. 서비스 이용 시작</p>
      </div>

      <p className="text-xs text-gray-400 mt-6">문의: help@matchpost.kr</p>
    </div>
  )
}
