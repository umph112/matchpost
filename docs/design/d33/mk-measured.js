const fs = require('node:fs')
const pc = require('c:/Users/user/matchpost/docs/design/d33/screens/measure-pc.json')
const mo = require('c:/Users/user/matchpost/docs/design/d33/screens/measure-mobile.json')
const M = Object.fromEntries(mo.rows.map((r) => [r.화면, r]))
const px = (n) => (n > 0 ? n + 'px' : '—')

let s = ''
s += '# D33 — 두 폭 실측\n\n'
s += '셸 판정을 user-agent 에서 화면 폭(lg = 1024px)으로 바꾼 뒤 잰 값입니다.\n'
s += '캡처는 `screens/pc/` · `screens/mobile/` 에 같은 이름으로 있습니다(각 45장).\n\n'
s += '- **본문** — `main` 폭. 그게 없는 화면은 body 아래에서 폭을 가진 첫 칸\n'
s += '- **내용** — `main` 이 없는 화면에서 스스로 폭을 제한한 가장 바깥 칸. 바깥 래퍼만 보면 갇힌 화면이 안 갇힌 것처럼 보인다\n'
s += '- **첫칸** — `main` 의 첫 자식(대개 화면 최상위 래퍼) 폭\n'
s += '  - 본문 안쪽 폭(좌우 패딩 뺀 값)과 **같으면 정상**\n'
s += '  - 그보다 **좁으면 버그** — `mx-auto` 가 flex 안에서 쪼그라든 것이다. PC 해제에 `mx-0` 이 빠졌다\n'
s += '  - ⚠️ 이 값으로 「PC 구성이 있는지」는 판단할 수 없다. 그건 캡처를 보고\n'
s += '    「가로로 긴 줄이 세로로 쌓였는지」로 판단한다 (D33 에서 이 해석을 두 번 틀렸다)\n\n'
s += '추측이 아니라 `getBoundingClientRect()` 값입니다.\n\n'
s += '| 화면 | 주소 | PC 본문 | PC 내용 | PC 첫칸 | PC 사이드바 | 모바일 본문 | 모바일 첫칸 | 모바일 하단탭 | 모바일 가로스크롤 |\n'
s += '| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |\n'
for (const r of pc.rows) {
  const m = M[r.화면] || {}
  const addr = r.주소 + (r.도착 && r.도착 !== r.주소 ? ' ↪ ' + r.도착 : '')
  const of = m.가로스크롤 ? '⚠️ ' + (m.범인 && m.범인[0] ? m.범인[0] : '') : ''
  s += `| ${r.화면} | ${addr} | ${px(r.본문폭)} | ${px(r.콘텐츠폭)} | ${px(r.첫칸폭)} | ${px(r.사이드바)} | ${px(m.본문폭)} | ${px(m.첫칸폭)} | ${px(m.하단탭)} | ${of} |\n`
}
s += '\n## 못 본 화면\n\n데이터가 없어 열지 못했습니다. 「다 봤다」가 거짓이 되지 않게 적어 둡니다.\n\n'
for (const k of pc.skipped || []) s += '- ' + k + '\n'
fs.writeFileSync('c:/Users/user/matchpost/docs/design/d33/MEASURED.md', s, 'utf8')
console.log('wrote', s.split('\n').length, 'lines /', pc.rows.length, 'rows')
