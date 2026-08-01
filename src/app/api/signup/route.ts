import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// 개발 기간: 이메일 인증/RLS 우회를 위해 service_role로 계정+프로필을 즉시 생성.
// (베타 진입 시 이메일 인증·본인인증 등 보안 절차 추가 예정)
export async function POST(req: Request) {
  const body = await req.json()
  const { role, name, activityName, email, phone, password, categories } = body

  if (!role || !name || !email || !password) {
    return NextResponse.json({ error: '필수 항목이 누락됐어요.' }, { status: 400 })
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const isInfluencer = role === 'influencer'

  // 1) auth 계정 생성 (이메일 자동 확인)
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (createErr || !created.user) {
    return NextResponse.json({ error: createErr?.message ?? '계정 생성에 실패했어요.' }, { status: 400 })
  }
  const uid = created.user.id

  // 2) 공개 프로필 생성 (활동명·등급만 — service_role → RLS 우회)
  const { error: profErr } = await admin.from('profiles').insert({
    id: uid,
    name: isInfluencer ? activityName : name,
    role,
    status: isInfluencer ? 'approved' : 'pending',
  })
  if (profErr) {
    await admin.auth.admin.deleteUser(uid) // 롤백
    return NextResponse.json({ error: profErr.message }, { status: 400 })
  }

  // 2-1) 민감정보 분리 저장 (본인·관리자만 조회 가능)
  await admin.from('user_private').insert({
    user_id: uid,
    real_name: name,
    phone,
    email,
  })

  // 3) 역할별 세부 프로필
  if (isInfluencer) {
    await admin.from('influencer_profiles').insert({
      user_id: uid,
      categories: categories ?? [], // index 0 = 메이저
    })
  } else {
    await admin.from('advertiser_profiles').insert({ user_id: uid })
  }

  // 4) 가입 환영 크레딧 지급 (광고주 10만 / 인플루언서 5만)
  await admin.rpc('grant_credits', {
    p_user_id: uid,
    p_amount: isInfluencer ? 50000 : 100000,
    p_action: isInfluencer ? 'welcome_influencer' : 'welcome_advertiser',
    p_description: '가입 환영 크레딧',
  })

  return NextResponse.json({ ok: true, role })
}
