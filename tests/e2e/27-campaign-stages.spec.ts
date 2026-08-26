import { expect, test } from '@playwright/test'
import {
  ALL_STAGES,
  STAGE_OWNER,
  computeEnabledStages,
  type Stage,
  type StageToggles,
} from '../../src/lib/campaign-stages'

// D30 [2] — 캠페인 딜시트가 「등록 때 정한 단계」로 열리는지.
//
// 왜 브라우저를 안 쓰나: 이 스펙을 쓸 때는 캠페인에 참여할 길이 아예 없어서
// (검색 카드의 유일한 버튼이 캠페인 id 를 안 들고 갔다) 화면으로는 캠페인 딜시트를
// 한 번도 열 수 없었다. 배선은 D32 1·2절에서 이었고, 브라우저로 도는 확인은
// 30-campaign-apply.spec.ts 가 맡는다. 단계 조합은 순수 함수라 여기서 표로 못 박는다 —
// 이 표가 「딜시트가 이렇게 열려야 한다」의 기준이다.
//
// ⚠️ D32 3절에서 「가이드」 결함을 고쳤다. 아래 조합 표에 '가이드'가 붙은 것과
//    맨 끝 테스트가 뒤집힌 것이 그 흔적이다 — 예고한 대로 실패가 신호가 됐다.

type Row = { toggles: StageToggles; expected: Stage[] }

// 광고주가 등록 화면에서 고를 수 있는 조합 전부(지역 여부 × 사전 컨펌 × 게재뒤수정 = 8).
// '가이드'는 끄고 켤 항목이 아니라 늘 거치는 단계라 8조합 전부에 들어간다(D32 3절).
const 조합: Row[] = [
  {
    toggles: { campaignType: '지역', preConfirm: false, postEdit: false },
    expected: ['협의', '수락', '가이드', '방문', '게재', '정산'],
  },
  {
    toggles: { campaignType: '지역', preConfirm: false, postEdit: true },
    expected: ['협의', '수락', '가이드', '방문', '게재', '게재뒤수정', '정산'],
  },
  {
    toggles: { campaignType: '지역', preConfirm: true, postEdit: false },
    expected: ['협의', '수락', '가이드', '방문', '원고', '수정/컨펌', '게재', '정산'],
  },
  {
    toggles: { campaignType: '지역', preConfirm: true, postEdit: true },
    expected: ['협의', '수락', '가이드', '방문', '원고', '수정/컨펌', '게재', '게재뒤수정', '정산'],
  },
  {
    toggles: { campaignType: '제품', preConfirm: false, postEdit: false },
    expected: ['협의', '수락', '가이드', '게재', '정산'],
  },
  {
    toggles: { campaignType: '제품', preConfirm: false, postEdit: true },
    expected: ['협의', '수락', '가이드', '게재', '게재뒤수정', '정산'],
  },
  {
    toggles: { campaignType: '제품', preConfirm: true, postEdit: false },
    expected: ['협의', '수락', '가이드', '원고', '수정/컨펌', '게재', '정산'],
  },
  {
    toggles: { campaignType: '제품', preConfirm: true, postEdit: true },
    expected: ['협의', '수락', '가이드', '원고', '수정/컨펌', '게재', '게재뒤수정', '정산'],
  },
]

const 이름 = (t: StageToggles) =>
  `${t.campaignType} · 사전컨펌 ${t.preConfirm ? 'ON' : 'OFF'} · 게재뒤수정 ${t.postEdit ? 'ON' : 'OFF'}`

test('[캠페인 단계] 8조합이 등록 때 정한 그대로 나온다', () => {
  for (const { toggles, expected } of 조합) {
    expect(computeEnabledStages(toggles), 이름(toggles)).toEqual(expected)
  }
  console.log(`[캠페인 단계] 8조합 확인 — ${조합.map((r) => computeEnabledStages(r.toggles).length).join('/')}단계`)
})

// 단계를 켜고 끄는 것이지 순서를 바꾸는 게 아니다. 순서가 흐트러지면 딜시트의 「→」가
// 뒤로 가는 일이 생긴다(reindexStage 가 ALL_STAGES 순서를 전제로 계산한다).
test('[캠페인 단계] 어떤 조합도 전체 9단계의 순서를 지킨다', () => {
  for (const { toggles } of 조합) {
    const got = computeEnabledStages(toggles)
    const idx = got.map((s) => ALL_STAGES.indexOf(s))
    expect(idx, `${이름(toggles)} — 알 수 없는 단계가 섞였다`).not.toContain(-1)
    expect(idx, `${이름(toggles)} — 순서가 뒤집혔다`).toEqual([...idx].sort((a, b) => a - b))
    expect(new Set(got).size, `${이름(toggles)} — 같은 단계가 두 번 나온다`).toBe(got.length)
  }
})

// ─────────────────────────────────────────────────────────────
// 「가이드」 — 고쳐진 뒤 (D32 3절)
// ─────────────────────────────────────────────────────────────
// 가이드는 ALL_STAGES 에도 있고 STAGE_OWNER 에도 '광고주' 로 적혀 있는데
// computeEnabledStages 만 빠뜨려서, 어떤 조합으로 등록해도 딜시트에 안 나왔다.
// 광고주가 가이드를 주는 칸이 통째로 없었던 것이다. 이제 항상 나온다.
//
// 뒤집어서 남겨 둔다 — 다시 빠지면 여기서 걸린다.
test('[캠페인 단계] 「가이드」는 어떤 조합에서도 나온다', () => {
  // 등록 화면에 없는 값까지 넣어 본다 — 특정 캠페인 구분에서만 켜지는 게 아니라는 걸 보이려고.
  const 구분: (string | null)[] = [null, '지역', '제품', '기자단', '기타']
  const 빠진조합: string[] = []
  const 나온적 = new Set<string>()
  for (const campaignType of 구분) {
    for (const preConfirm of [false, true]) {
      for (const postEdit of [false, true]) {
        const got = computeEnabledStages({ campaignType, preConfirm, postEdit })
        for (const s of got) 나온적.add(s)
        if (!got.includes('가이드')) 빠진조합.push(이름({ campaignType, preConfirm, postEdit }))
      }
    }
  }

  expect(STAGE_OWNER['가이드'], '표에는 담당자가 적혀 있다 — 쓰려던 단계였다는 뜻').toBe('advertiser')
  expect(ALL_STAGES).toContain('가이드')
  expect(빠진조합, '가이드가 빠진 조합이 있으면 안 된다').toEqual([])

  // 20조합을 다 합치면 9단계가 한 번씩은 나와야 한다. 다른 단계가 또 새면 여기서 걸린다.
  expect([...ALL_STAGES].filter((s) => !나온적.has(s)), '어느 조합에서도 안 나오는 단계').toEqual([])

  console.log('[캠페인 단계] 20조합 전부에 가이드 포함 — 9단계 모두 최소 한 번 등장')
})

/* D32 3절에서 고쳤다. 남겨 두는 이유: 이 글이 곧 그때의 근거다.
  finding(
    '결함',
    '캠페인 딜시트 「가이드」 단계',
    '캠페인은 등록 때 고른 조합으로 딜시트가 열리는데(computeEnabledStages), 그 함수가 「가이드」를 ' +
      '어떤 조합에서도 안 내보냅니다 — 캠페인 구분 5가지 × 사전컨펌 × 게재뒤수정 20조합 전수 확인. ' +
      '가이드는 ALL_STAGES 에 있고 STAGE_OWNER 에도 advertiser 로 적혀 있어 쓰려던 단계가 맞습니다. ' +
      '오픈 협업은 9단계 고정이라 가이드가 나오는데(deals/openDeal.ts:9) 캠페인만 빠집니다. ' +
      '결과: 광고주가 가이드를 주는 칸이 캠페인에서는 통째로 없습니다(campaign-stages.ts:17).',
  )
*/
