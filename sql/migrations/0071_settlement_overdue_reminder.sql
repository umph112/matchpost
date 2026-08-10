-- 0071  정산 지연 알림 매일 1회 — D6 C5
--
-- 지급 예정일이 지나고 기록이 없으면 광고주에게 매일 1회 알림 + 누적 횟수 저장(제재 판정 근거).
-- 양쪽이 대화에서 예정일 변경에 합의하면(=campaigns.settlement_date가 바뀌면) 그 시점부터
-- 다시 새 예정일 기준으로 판정되므로 자연히 지연이 아니게 된다.

begin;

alter table campaigns
  add column if not exists overdue_reminder_count int not null default 0;

create or replace function run_settlement_reminder_batch()
returns table(campaign_id uuid, count int)
language plpgsql
security definer
as $$
declare
  r record;
begin
  for r in
    select c.id, c.advertiser_id, c.title, c.overdue_reminder_count
    from campaigns c
    where c.settlement_date is not null
      and c.settlement_date < (now() at time zone 'Asia/Seoul')::date
      and exists (
        select 1 from proposals p
        where p.campaign_id = c.id
          and p.advertiser_confirmed = true and p.influencer_confirmed = true
          and coalesce(p.settlement_status, '미정산') <> '완료'
      )
  loop
    update campaigns set overdue_reminder_count = overdue_reminder_count + 1 where id = r.id;

    insert into notifications (user_id, type, kind, title, body, link, ref_type, ref_id, state)
    values (
      r.advertiser_id, 'settlement_overdue', 'settlement_overdue',
      '정산 예정일이 지났어요',
      r.title || ' — 미수 상태예요. 정산 화면에서 확인해주세요.',
      '/advertiser/settlements', 'campaign', r.id, 'unread'
    );

    -- 캠페인 대화에 시스템 줄로 남긴다(A9) — 참여자 전원에게, 말풍선이 아니라 표시만
    insert into messages (sender_id, receiver_id, proposal_id, content, is_system)
    select r.advertiser_id, p.influencer_id, p.id,
      to_char(now() at time zone 'Asia/Seoul', 'MM월 DD일') || ' · 지연 알림 발송 (' || (r.overdue_reminder_count + 1) || '회)' ||
      case when r.overdue_reminder_count + 1 >= 3 then ' · 3일째부터 운영팀이 함께 확인합니다' else '' end,
      true
    from proposals p
    where p.campaign_id = r.id and p.advertiser_confirmed = true and p.influencer_confirmed = true;

    campaign_id := r.id; count := r.overdue_reminder_count + 1;
    return next;
  end loop;
end;
$$;

revoke execute on function run_settlement_reminder_batch() from public, anon, authenticated;
grant  execute on function run_settlement_reminder_batch() to service_role;

commit;
