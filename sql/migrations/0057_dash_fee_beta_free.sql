-- 0057  C-1 대시 발송 과금 — 베타 기간 무료로 전환
--
-- ⚠️ 문서(IMPLEMENT-4-SERVER.md ⑥)는 "대시 발송 100C"라고 적혀 있지만, 실제 0018 트리거는
-- 500C를 차감하고 있었다(creditConfig.ts의 SEND_PROPOSAL도 500). 문서 수치가 아니라
-- 실제 운영 중인 값(500C) 기준으로 껐다 — 화면에도 100C/500C 어느 쪽도 노출된 곳이 없어서
-- (grep 확인) 별도로 지울 UI 문구는 없었다.
--
-- 트리거를 지우지 않고 함수 안에서 조건으로 끈다 — 나중에 재개하려면 v_dash_fee_enabled만
-- true로 바꿔서 새 마이그레이션을 추가하면 된다.

begin;

create or replace function trg_fn_credit_dash_send()
returns trigger language plpgsql security definer as $$
declare
  v_dash_fee_enabled constant boolean := false;  -- 베타 기간 대시 발송 무료 정책
begin
  if v_dash_fee_enabled then
    perform credit_ledger_charge(new.advertiser_id, 500, 'send_proposal', 'proposal', new.id, '대시 발송');
  end if;
  return new;
end;
$$;

commit;
