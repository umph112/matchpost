import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// 초대 링크(토큰)로 가입 — 일반 광고주 가입과 다른 경로다.
//  · 사업자 정보를 다시 받지 않는다(초대한 회사에 소속되므로).
//  · 이메일은 초대에 박제된 값 그대로(폼에서 read-only), 여기서도 토큰에서만 읽는다.
//  · 재심사 없이 바로 승인(active) → 대시보드로. 가입 축하 크레딧은 지급하지 않는다.
export async function POST(req: Request) {
  const { token, name, phone, password } = await req.json()
  if (!token || !name || !password) {
    return NextResponse.json({ error: '필수 항목이 누락됐어요.' }, { status: 400 })
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // 토큰 재검증 (프런트 표시와 별개로 서버에서 다시 — 만료·재사용 차단)
  const { data: row } = await admin
    .from('team_members')
    .select('id, owner_id, email, role, status, token_expires')
    .eq('invite_token', token)
    .maybeSingle()
  if (!row) return NextResponse.json({ error: '유효하지 않은 초대 링크예요.' }, { status: 400 })
  if (row.status !== 'invited') return NextResponse.json({ error: '이미 사용된 초대 링크예요.' }, { status: 400 })
  if (row.token_expires && new Date(row.token_expires) < new Date()) {
    return NextResponse.json({ error: '만료된 초대 링크예요.' }, { status: 400 })
  }

  const email = row.email

  // 1) auth 계정 생성
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (createErr || !created.user) {
    return NextResponse.json({ error: createErr?.message ?? '계정 생성에 실패했어요.' }, { status: 400 })
  }
  const uid = created.user.id

  // 2) 공개 프로필 — 초대 멤버는 재심사 없이 바로 승인
  const { error: profErr } = await admin.from('profiles').insert({
    id: uid,
    name,
    role: 'advertiser',
    status: 'approved',
    manager_phone: phone || null,
  })
  if (profErr) {
    await admin.auth.admin.deleteUser(uid) // 롤백
    return NextResponse.json({ error: profErr.message }, { status: 400 })
  }

  // 2-1) 민감정보 분리 저장
  await admin.from('user_private').insert({ user_id: uid, real_name: name, phone, email })

  // 3) 소속 브랜드 표시용 advertiser_profiles — 사업자정보는 없이 소유자 회사명만 복사.
  //    (조직 구조를 바꾸지 않으면서 멤버 콘솔에 올바른 회사명이 뜨게 하려는 최소 처리.
  //     biz_reg_number는 null이라 사업자번호 유니크 인덱스와 충돌하지 않는다.)
  const { data: ownerAdv } = await admin
    .from('advertiser_profiles')
    .select('company_name')
    .eq('user_id', row.owner_id)
    .maybeSingle()
  await admin.from('advertiser_profiles').insert({
    user_id: uid,
    company_name: ownerAdv?.company_name || null,
    biz_reg_number: null,
  })

  // 4) 팀 멤버 활성화 + 토큰 소멸(1회용)
  await admin
    .from('team_members')
    .update({
      member_id: uid,
      status: 'active',
      joined_at: new Date().toISOString(),
      invite_token: null,
      token_expires: null,
    })
    .eq('id', row.id)

  // 초대 가입은 가입 축하 크레딧을 지급하지 않는다(회사 계정에 이미 쌓임).

  return NextResponse.json({ ok: true, email })
}
