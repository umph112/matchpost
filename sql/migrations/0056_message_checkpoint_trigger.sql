-- 0056  B-3 대화 체크포인트 연동 — messages.checkpoint_kind(0031)를 실제로 사용
--
-- 0031은 checkpoint_kind를 'guide' 하나로만 제한했는데, 이번 요청은 가이드/원고/게재
-- 3종을 다 지원해야 해서 제약을 넓힌다(안전한 확장 — 기존 'guide'/null 데이터는 그대로 유효).
--
-- 메시지에 checkpoint_kind가 찍히면(파일 전송 시 "OO로 등록" 체크) 트리거가 해당
-- proposal의 deal_checkpoints를 자동 완료 처리한다. 이미 완료된 체크포인트는 덮어쓰지 않는다
-- (재전송해도 최초 완료 시각 유지). 딜시트는 realtime 구독으로 별도 새로고침 없이 반영된다(클라이언트).

begin;

alter table messages drop constraint if exists messages_checkpoint_kind_check;
alter table messages
  add constraint messages_checkpoint_kind_check
  check (checkpoint_kind in ('guide', 'draft', 'publish') or checkpoint_kind is null);

create or replace function trg_fn_message_checkpoint_complete()
returns trigger
language plpgsql
security definer
as $$
declare
  v_due date;
begin
  if new.checkpoint_kind is null or new.proposal_id is null then
    return new;
  end if;

  select due_adjusted into v_due
  from deal_checkpoints
  where proposal_id = new.proposal_id and kind = new.checkpoint_kind and completed_at is null;

  if found then
    update deal_checkpoints
    set completed_at = now(),
        late_days = case when v_due is not null then greatest(0, (now()::date - v_due) - 3) else 0 end
    where proposal_id = new.proposal_id and kind = new.checkpoint_kind and completed_at is null;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_message_checkpoint_complete on messages;
create trigger trg_message_checkpoint_complete
after insert on messages
for each row execute function trg_fn_message_checkpoint_complete();

commit;
