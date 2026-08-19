import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { resolveCompany } from '@/lib/team/company'
import { viewShare, type ShareStats } from '@/lib/team/viewShare'
import { initial } from '@/lib/initial'

// 팀원 업무 현황 — D14 3절. 대표만 보는 화면(팀원 화면엔 없음).
// design/team-workload.dc.html 목업의 4블록 구조를 그대로 옮기되,
// 스키마에 실제로 있는 값만 채우고 없는 항목(인플루언서 평가·정산 기록·지연율·미수)은 '—' 로 둔다.
// (사용자 확정: "있는 것만 실데이터, 나머지 '—'". 상호평가/정산상태 테이블 생기면 그때 채움.)
export const dynamic = 'force-dynamic'

const DASH = '—'

type Row = {
  id: string
  name: string
  role: '대표' | '팀원'
  s: ShareStats
}

export default async function TeamWorkloadPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // 대표만 — 팀원은 이 화면을 볼 수 없다(목업: "이 화면은 대표만 봅니다").
  const company = await resolveCompany(supabase, user.id)
  if (!company.isOwner) redirect('/advertiser/dashboard')

  // 대표 + 활동중 팀원 목록
  const { data: teamRows } = await supabase
    .from('team_members')
    .select('member_id, role, status')
    .eq('owner_id', user.id)
    .eq('status', 'active')
  const memberIds = (teamRows ?? []).filter((r) => r.member_id).map((r) => r.member_id as string)

  const ids = [user.id, ...memberIds]
  const { data: profiles } = await supabase.from('profiles').select('id, name').in('id', ids)
  const nameById = Object.fromEntries((profiles ?? []).map((p) => [p.id, p.name]))

  const stats = await Promise.all(ids.map((id) => viewShare(supabase, user.id, id)))
  const rows: Row[] = ids.map((id, i) => ({
    id,
    name: nameById[id] || (id === user.id ? '대표' : '팀원'),
    role: id === user.id ? '대표' : '팀원',
    s: stats[i],
  }))

  const maxCamps = Math.max(1, ...rows.map((r) => r.s.camps))

  return (
    <div className="flex flex-col gap-4">
      {/* 헤더 */}
      <div className="flex items-center gap-2.5">
        <h1 className="text-lg font-extrabold tracking-[-0.02em] text-[#17171B]">팀원 업무 현황</h1>
        <span
          className="text-[10px] font-extrabold text-white bg-[#17171B] rounded-[5px] px-[7px] py-[3px]"
          title="이 화면은 대표만 봅니다. 팀원 화면엔 나타나지 않습니다."
        >
          대표만 보임
        </span>
        <span className="ml-1 text-[12px] text-[#9A9AA5]">이번 달 기준</span>
      </div>

      {/* 팀원 카드 */}
      <div className="flex flex-col gap-3">
        {rows.map((r) => (
          <MemberCard key={r.id} row={r} maxCamps={maxCamps} />
        ))}
      </div>

      {/* 읽는 법 */}
      <Howto />
    </div>
  )
}

function loadLabel(s: ShareStats, maxCamps: number): { text: string; bg: string; fg: string } | null {
  const heavy = s.camps >= maxCamps && s.camps > 0
  const stuck = s.waiting >= 2 || (s.respHours && s.respHours >= 12)
  if (stuck) return { text: '막힌 건 있음', bg: '#FEE2E2', fg: '#DC2626' }
  if (heavy) return { text: '가장 많이 맡음', bg: '#FEF3C7', fg: '#B45309' }
  return { text: '여유 있음', bg: '#F1F1F4', fg: '#7C7C88' }
}

function MemberCard({ row, maxCamps }: { row: Row; maxCamps: number }) {
  const { s } = row
  const load = loadLabel(s, maxCamps)
  const isOwner = row.role === '대표'
  const respTxt = s.respHours > 0 ? `${s.respHours}시간` : DASH

  // 4블록. sub 는 근거(있으면), 값 색: 나쁨=#DC2626, 좋음=#15803D, 기본=#17171B.
  const blocks: { title: string; dot: string; rows: { label: string; val: string; sub?: string; kind?: 'bad' | 'good' }[] }[] = [
    {
      title: '지금 들고 있는 것',
      dot: '#F59E0B',
      rows: [
        { label: '담당 캠페인', val: String(s.camps) },
        { label: '담당 인플루언서', val: String(s.infl) },
        { label: '진행 중 대화', val: String(s.talking) },
      ],
    },
    {
      title: '이번 달 처리한 것',
      dot: '#22C55E',
      rows: [
        { label: '완료', val: String(s.done), kind: s.done > 0 ? 'good' : undefined },
        { label: '정산 기록', val: DASH },
        { label: '신규 등록', val: String(s.campsNew) },
      ],
    },
    {
      title: '막혀 있는 것',
      dot: '#EF4444',
      rows: [
        { label: '지연율', val: DASH },
        { label: '응답 대기', val: String(s.waiting), kind: s.waiting >= 2 ? 'bad' : undefined },
        { label: '미수', val: DASH },
      ],
    },
    {
      title: '상대가 본 것',
      dot: '#3B82F6',
      rows: [
        { label: '인플루언서 평가', val: DASH },
        { label: '평균 응답', val: respTxt, kind: s.respHours >= 12 ? 'bad' : undefined },
      ],
    },
  ]

  return (
    <div className="bg-white rounded-2xl border border-[#EAEAEE] overflow-hidden">
      {/* 카드 헤더 */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-[#F1F1F4]">
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-extrabold shrink-0"
          style={isOwner ? { background: '#17171B', color: '#fff' } : { background: '#FEF3C7', color: '#B45309' }}
        >
          {initial(row.name)}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[14px] font-bold text-[#17171B]">{row.name}</span>
          <span
            className="text-[10px] font-bold rounded-[5px] px-[6px] py-[2px]"
            style={isOwner ? { background: '#17171B', color: '#fff' } : { background: '#F1F1F4', color: '#5C5C68' }}
          >
            {row.role}
          </span>
        </div>
        {load && (
          <span
            className="ml-auto text-[11px] font-bold rounded-full px-2.5 py-1"
            style={{ background: load.bg, color: load.fg }}
          >
            {load.text}
          </span>
        )}
      </div>

      {/* 4블록 */}
      <div className="grid" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
        {blocks.map((b, i) => (
          <div
            key={b.title}
            style={{ padding: '15px 18px 17px', borderRight: i < 3 ? '1px solid #F1F1F4' : undefined }}
          >
            <div className="flex items-center gap-1.5 mb-2.5">
              <span style={{ width: 6, height: 6, borderRadius: 2, background: b.dot, display: 'inline-block' }} />
              <span className="text-[11px] font-bold text-[#5C5C68]">{b.title}</span>
            </div>
            <div className="flex flex-col gap-1.5">
              {b.rows.map((rw) => (
                <div key={rw.label} className="flex items-baseline justify-between gap-2">
                  <span className="text-[12px] text-[#7C7C88]">{rw.label}</span>
                  <span
                    className="text-[14px] font-extrabold tabular-nums"
                    style={{ color: rw.kind === 'bad' ? '#DC2626' : rw.kind === 'good' ? '#15803D' : '#17171B' }}
                  >
                    {rw.val}
                    {rw.sub && <span className="ml-1 text-[10px] font-semibold text-[#B0B0BB]">{rw.sub}</span>}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function Howto() {
  const items = [
    '「지금 들고 있는 것」은 그 사람이 현재 맡고 있는 양입니다. 한 사람에게 쏠려 있으면 나눠 주세요.',
    '「이번 달 처리한 것」은 이번 달에 실제로 끝낸 양입니다. 많고 적음이 아니라 흐름을 봅니다.',
    '「막혀 있는 것」에 숫자가 크면 그 사람이 아니라 그 일에 도움이 필요하다는 신호입니다.',
    '「상대가 본 것」은 인플루언서 쪽에서 그 사람을 어떻게 느끼는지입니다. (평가 기능 준비 중)',
    "'—' 는 아직 집계할 데이터가 없다는 뜻입니다. 지어낸 값이 아닙니다.",
  ]
  return (
    <div className="bg-[#FAFAFB] rounded-2xl border border-[#EAEAEE] px-5 py-4">
      <div className="text-[12px] font-bold text-[#5C5C68] mb-2">이 화면을 읽는 법</div>
      <ul className="flex flex-col gap-1.5">
        {items.map((t, i) => (
          <li key={i} className="text-[12px] text-[#7C7C88] leading-relaxed flex gap-2">
            <span className="text-[#B0B0BB]">·</span>
            <span>{t}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
