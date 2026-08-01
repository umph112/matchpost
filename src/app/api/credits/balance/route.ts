import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '로그인이 필요해요.' }, { status: 401 })

  const { data } = await supabase
    .from('credits')
    .select('balance')
    .eq('user_id', user.id)
    .single()

  return NextResponse.json({ balance: data?.balance ?? 0 })
}
