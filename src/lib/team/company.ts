import type { SupabaseClient } from '@supabase/supabase-js'

// 회사(대표) 해석 — D14 1절의 토대.
//
// team_members 스키마(0063/0080): owner_id = 회사(대표), member_id = 로그인한 팀원,
// status in ('invited','active','inactive'). 팀원은 status='active' 일 때만 회사에 붙는다.
//
// 대표에게는 user.id 가 곧 회사라, 대표 경로에선 이 함수가 사실상 무변경(no-op)이다.
// 팀원이면 소속 회사(owner_id)로 해석해 회사 단위의 데이터를 보게 한다.
export type Company = {
  advertiserId: string // 회사 = 데이터 소유 단위 (대표의 id)
  myId: string // 로그인한 본인 id
  isOwner: boolean // 대표 본인인가
  isMember: boolean // 활동중 팀원인가
  role: string // '대표' | '팀원'
}

export async function resolveCompany(
  supabase: SupabaseClient,
  userId: string,
): Promise<Company> {
  // 활동중 팀원인지 확인 — member_id 로 소속 회사(owner_id)를 찾는다.
  const { data: membership } = await supabase
    .from('team_members')
    .select('owner_id, role')
    .eq('member_id', userId)
    .eq('status', 'active')
    .maybeSingle()

  if (membership?.owner_id) {
    return {
      advertiserId: membership.owner_id,
      myId: userId,
      isOwner: false,
      isMember: true,
      role: membership.role ?? '팀원',
    }
  }

  // 팀원이 아니면 본인이 회사(대표)다.
  return {
    advertiserId: userId,
    myId: userId,
    isOwner: true,
    isMember: false,
    role: '대표',
  }
}
