// 크레딧 원장 서버 액션 레이어 — sql/migrations/0018_credit_ledger.sql의 Postgres 함수를 감싼다.
// 클라이언트에서 직접 호출하지 않는다(service-role). 잔액은 항상 credit_balances 뷰에서 합산해 읽는다.
import { createServiceClient } from '@/lib/supabase/service'

export type CreditRefType = 'schedule' | 'campaign' | 'proposal' | 'deal' | 'review' | 'invite'
export type CreditGrantKind = 'welcome' | 'reward' | 'purchase' | 'admin'

export type CreditBalance = {
  freeBalance: number
  paidBalance: number
  balance: number
}

type RefParams = {
  refType?: CreditRefType
  refId?: string
  memo?: string
}

export async function getBalance(userId: string): Promise<CreditBalance> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('credit_balances')
    .select('free_balance, paid_balance, balance')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw new Error(error.message)

  return {
    freeBalance: data?.free_balance ?? 0,
    paidBalance: data?.paid_balance ?? 0,
    balance: data?.balance ?? 0,
  }
}

// 차감: free 우선 소진 → 부족분 paid. 잔액 부족 시 예외(insufficient_credit).
export async function chargeCredits(
  userId: string,
  amount: number,
  reasonCode: string,
  params: RefParams = {}
): Promise<void> {
  const supabase = createServiceClient()
  const { error } = await supabase.rpc('credit_ledger_charge', {
    p_user_id: userId,
    p_amount: amount,
    p_reason_code: reasonCode,
    p_ref_type: params.refType ?? null,
    p_ref_id: params.refId ?? null,
    p_memo: params.memo ?? null,
  })
  if (error) throw new Error(error.message)
}

// 지급: welcome/reward/purchase/admin. 유상 충전 미구현이므로 항상 free 지갑에 쌓인다.
export async function grantCredits(
  userId: string,
  amount: number,
  kind: CreditGrantKind,
  reasonCode: string,
  params: RefParams & { adminId?: string } = {}
): Promise<void> {
  const supabase = createServiceClient()
  const { error } = await supabase.rpc('credit_ledger_grant', {
    p_user_id: userId,
    p_amount: amount,
    p_kind: kind,
    p_reason_code: reasonCode,
    p_ref_type: params.refType ?? null,
    p_ref_id: params.refId ?? null,
    p_memo: params.memo ?? null,
    p_admin_id: params.adminId ?? null,
  })
  if (error) throw new Error(error.message)
}

// 환불: 기존 행은 그대로 두고 반대 부호의 새 행을 쌓는다.
export async function refundCredits(
  userId: string,
  amount: number,
  reasonCode: string,
  params: RefParams = {}
): Promise<void> {
  const supabase = createServiceClient()
  const { error } = await supabase.rpc('credit_ledger_refund', {
    p_user_id: userId,
    p_amount: amount,
    p_reason_code: reasonCode,
    p_ref_type: params.refType ?? null,
    p_ref_id: params.refId ?? null,
    p_memo: params.memo ?? null,
  })
  if (error) throw new Error(error.message)
}

// 페널티: 확정 후 취소 시 취소한 쪽에만. 무상 지갑만 차감(유상 지갑은 절대 건드리지 않음).
export async function applyPenalty(
  userId: string,
  amount: number,
  reasonCode: string,
  params: RefParams = {}
): Promise<void> {
  const supabase = createServiceClient()
  const { error } = await supabase.rpc('credit_ledger_penalty', {
    p_user_id: userId,
    p_amount: amount,
    p_reason_code: reasonCode,
    p_ref_type: params.refType ?? null,
    p_ref_id: params.refId ?? null,
    p_memo: params.memo ?? null,
  })
  if (error) throw new Error(error.message)
}
