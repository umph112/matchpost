-- 0074  캠페인 대화에서도 파일 첨부 허용 — D7 3-6
--
-- 0066의 send_campaign_message()는 텍스트만 받았다. 가이드 배포는 캠페인 대화(전원 발송)가
-- 기본 경로이므로 파일 필드를 추가한다. p_content가 비어있어도 파일만 보낼 수 있게 둘 다 optional.

begin;

drop function if exists send_campaign_message(uuid, uuid, text, uuid, boolean);

create or replace function send_campaign_message(
  p_advertiser_id uuid,
  p_campaign_id   uuid,
  p_content       text,
  p_only_influencer_id uuid,
  p_proxy         boolean,
  p_file_url      text default null,
  p_file_name     text default null,
  p_file_type     text default null,
  p_checkpoint_kind text default null
) returns void
language plpgsql
security definer
as $$
declare
  v_broadcast_id uuid := gen_random_uuid();
  r record;
begin
  if p_only_influencer_id is not null then
    select id into r from proposals
      where campaign_id = p_campaign_id and influencer_id = p_only_influencer_id
      order by created_at desc limit 1;
    if r.id is null then
      raise exception 'participant not found' using errcode = 'P0002';
    end if;
    insert into messages (sender_id, receiver_id, proposal_id, content, targeted_only, proxy, file_url, file_name, file_type, checkpoint_kind)
    values (p_advertiser_id, p_only_influencer_id, r.id, p_content, true, coalesce(p_proxy, false), p_file_url, p_file_name, p_file_type, p_checkpoint_kind);
  else
    for r in
      select distinct on (influencer_id) id, influencer_id
      from proposals
      where campaign_id = p_campaign_id
      order by influencer_id, created_at desc
    loop
      insert into messages (sender_id, receiver_id, proposal_id, content, broadcast_id, proxy, file_url, file_name, file_type, checkpoint_kind)
      values (p_advertiser_id, r.influencer_id, r.id, p_content, v_broadcast_id, coalesce(p_proxy, false), p_file_url, p_file_name, p_file_type, p_checkpoint_kind);
    end loop;
  end if;
end;
$$;

revoke execute on function send_campaign_message(uuid, uuid, text, uuid, boolean, text, text, text, text) from public, anon, authenticated;
grant  execute on function send_campaign_message(uuid, uuid, text, uuid, boolean, text, text, text, text) to service_role;

commit;
