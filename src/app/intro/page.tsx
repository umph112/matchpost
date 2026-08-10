import { redirect } from 'next/navigation'

// D7 부록 체크리스트 — "/intro가 정리됐다(삭제 또는 /로 통합)". 새 랜딩(/)이 같은 역할(브랜드
// 소개 + 로그인)을 이미 겸하고 있어 중복 페이지를 남기지 않고 통합했다.
export default function IntroPage() {
  redirect('/')
}
