// D6 B1/B3 — 진행 과정은 조립식이다.
// 전체 9단계 중 캠페인 구분·광고주 선택에 따라 켜고 끈다.

export const ALL_STAGES = ['협의', '수락', '가이드', '방문', '원고', '수정/컨펌', '게재', '게재뒤수정', '정산'] as const
export type Stage = (typeof ALL_STAGES)[number]

export type StageToggles = {
  campaignType: string | null // '지역' | '제품' | '기자단' | ...
  preConfirm: boolean         // 수정/컨펌(사전 컨펌) — 켜져 있으면 원고 단계도 딸려온다
  postEdit: boolean           // 게재뒤수정 — 단독으로 켜고 끌 수 있다
}

// 방문은 지역 캠페인일 때만 자동. 원고는 사전 컨펌에 딸린다.
//
// D32 3절 — '가이드'는 어떤 조합에서도 안 나오고 있었다. ALL_STAGES·STAGE_OWNER·
// LEGACY_STAGE_MAP·체크포인트 키('guide')·인플루언서 대시보드 문구까지 다 갖춰져
// 있는데 이 함수만 안 넣어서, 대화창의 「가이드로 등록」이 자동 완료시킬 단계가
// 캠페인 딜시트엔 아예 없었다. 끄고 켤 항목이 아니라 늘 거치는 단계라 항상 넣는다 —
// 가이드 없이 진행되는 캠페인은 없고, 취소 점수도 「가이드 이후냐」로 갈린다.
export function computeEnabledStages(t: StageToggles): Stage[] {
  const stages: Stage[] = ['협의', '수락', '가이드']
  if (t.campaignType === '지역') stages.push('방문')
  if (t.preConfirm) stages.push('원고', '수정/컨펌')
  stages.push('게재')
  if (t.postEdit) stages.push('게재뒤수정')
  stages.push('정산')
  return stages
}

export function stageHintLine(t: StageToggles): string {
  if (t.preConfirm && t.postEdit) return '원고를 받아 컨펌한 뒤 게재하고, 게재 후에도 수정을 요청할 수 있어요.'
  if (t.preConfirm) return '원고를 미리 받아 컨펌한 뒤 게재해요.'
  if (t.postEdit) return '원고 없이 먼저 게재하고, 게재 후에 수정을 요청해요.'
  return '가이드대로 게재하면 끝나요 - 수정 단계가 없으니 가이드를 자세히 적어주세요.'
}

// B3 — 단계를 끄면 그 단계에 있던 사람은 다음 살아있는 단계로 읽는다.
// 자기 자신은 세지 않는다: slice(0, i)가 아니라 slice(0, i+1)로 하면 이미 끝낸 앞 단계로
// 되돌아가는 버그가 생긴다(문서에 실제로 발생했다고 적혀 있음) — 반드시 slice(0, i).
export function reindexStage(currentStage: string | null, activeStages: Stage[]): Stage {
  const stage = (currentStage ?? ALL_STAGES[0]) as Stage
  if (activeStages.includes(stage)) return stage
  const i = ALL_STAGES.indexOf(stage)
  if (i < 0) return activeStages[0]
  const off = new Set(ALL_STAGES.filter((s) => !activeStages.includes(s)))
  const drop = ALL_STAGES.slice(0, i).filter((s) => off.has(s)).length
  const idx = Math.min(Math.max(i - drop, 0), activeStages.length - 1)
  return activeStages[idx]
}

// 옛(D5 이전) 저장값 → 새 9단계 이름 매핑. 기존 proposals.stage 데이터를 위한 것.
export const LEGACY_STAGE_MAP: Record<string, Stage> = {
  '신청': '협의',
  '확정': '수락',
  '가이드': '가이드',
  '방문': '방문',
  '업로드': '원고',
  '수정/컴프': '수정/컨펌',
  '검사': '게재',
  '정산': '정산',
}

// D29 PROMPT-4 — 단계마다 넘기는 사람이 다르다. 원고 제출·게재는 인플루언서가 하는 일이라
// 광고주가 대신 눌러주기를 기다리게 두면 안 된다.
// ⚠️ 이 표가 유일한 출처다 — 화면(DealSheet)과 서버액션(lib/deals/progress.ts)이 같이 읽는다.
//    두 곳에 나눠 적으면 어긋난다.
export type StageOwner = 'advertiser' | 'influencer'

export const STAGE_OWNER: Record<Stage, StageOwner> = {
  '협의': 'advertiser',
  '수락': 'advertiser',
  '가이드': 'advertiser',   // 가이드를 주는 쪽
  '방문': 'influencer',
  '원고': 'influencer',
  '수정/컨펌': 'advertiser', // 확인하는 쪽
  '게재': 'influencer',
  '게재뒤수정': 'advertiser', // 확인하는 쪽
  '정산': 'advertiser',     // 돈 보내는 쪽
}

// 지금 이 단계를 넘길 차례인 사람. 옛 저장값('신청'·'업로드' 등)도 새 이름으로 옮겨 본다.
// 알 수 없는 값이면 첫 단계(광고주)로 본다 — 아무나 넘기게 두는 쪽보다 안전하다.
export function stageOwnerOf(stage: string | null): StageOwner {
  if (!stage) return STAGE_OWNER[ALL_STAGES[0]]
  const mapped = (LEGACY_STAGE_MAP[stage] ?? stage) as Stage
  return STAGE_OWNER[mapped] ?? STAGE_OWNER[ALL_STAGES[0]]
}

// 자기 차례가 아닐 때 화면에 띄울 한 줄 — 지금 무엇을 기다리는지 보이게.
export function stageWaitingLine(owner: StageOwner): string {
  return owner === 'advertiser' ? '광고주가 확인하면 넘어가요' : '인플루언서가 진행하면 넘어가요'
}
