-- 0070  확정 인원이 생기면 진행 과정 구성 잠금 — D6 B4
--
-- 편집 화면(campaigns/[id]/edit)은 아직 없지만, 규칙 자체는 DB 제약으로 먼저 걸어둔다 —
-- 어떤 경로로 업데이트가 오든 first_confirmed_at 이후엔 stage_pre_confirm/stage_post_edit을
-- 못 바꾸게. "바꾸려면 취소 후 재등록"이 원칙이므로 예외를 두지 않는다.

begin;

create or replace function trg_fn_campaign_stage_lock()
returns trigger language plpgsql as $$
begin
  if old.first_confirmed_at is not null
     and (new.stage_pre_confirm is distinct from old.stage_pre_confirm
          or new.stage_post_edit is distinct from old.stage_post_edit)
  then
    raise exception 'stage config locked after first confirmation' using errcode = 'P0021';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_campaign_stage_lock on campaigns;
create trigger trg_campaign_stage_lock
  before update on campaigns
  for each row execute function trg_fn_campaign_stage_lock();

commit;
