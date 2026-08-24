import { dateRangeWithDow } from '@/lib/date'
import type { DealSheetCampaign } from '@/components/DealSheet'

// D29 1번 — 오픈에서 바로 성사된 협업(proposals.campaign_id = null)에는 딜시트가 없었다.
// 화면을 새로 만들지 않고, 오픈(schedules 한 줄)을 캠페인 모양으로 감싸 같은 딜시트에 넣는다.
//
// 단계는 8단계다 — 협의·수락·방문·원고·수정/컨펌·게재·게재뒤수정·정산.
// (campaign_type '지역' → 방문, preConfirm → 원고·수정/컨펌, postEdit → 게재뒤수정.
//  '가이드'는 computeEnabledStages 가 어떤 조합에서도 내놓지 않아 8이 코드상 최대치다.)
export type OpenScheduleRow = {
  id: string
  title: string | null
  date: string
  date_end?: string | null
  location_city?: string | null
  location_district?: string | null
  channels?: string[] | null
}

export function openDealCampaign(s: OpenScheduleRow): DealSheetCampaign {
  return {
    id: s.id,
    title: s.title ?? '오픈 협업',
    campaign_type: '지역', // 오픈은 날짜·장소를 걸고 여는 자리라 방문 단계를 쓴다
    channels: s.channels ?? null,
    date: dateRangeWithDow(s.date, s.date_end),
    location_city: s.location_city ?? null,
    location_district: s.location_district ?? null,
    // 오픈 협업은 1:1 이라 캠페인의 총예산·모집인원 개념이 없다. 없는 숫자를 지어내지 않는다.
    budget_total: null,
    recruit_target: 1,
    upload_deadline: null,
    inspection_deadline: null,
    settlement_date: null, // 결제일은 이 건에 합의된 proposals.settlement_date 를 쓴다
    status: null,
    stage_pre_confirm: true,
    stage_post_edit: true,
  }
}
