-- 0054  B-1 협업 시간 설정 + 겹침 체크 — proposals.start_at/duration_min(0029, 그동안 미사용) 실사용
--
-- "확정된 협업만 시간을 점유한다"는 문서 규칙대로, 겹침 판정은 양쪽 확정된(advertiser_confirmed
-- and influencer_confirmed) proposals끼리만 본다. 이 함수는 시간을 "설정"하는 단계 — 설정 시점에
-- 이미 확정된 다른 건과 겹치면 막는다. 최종 관문은 실제 확정(/api/deal/confirm)에서 한 번 더 검사한다
-- (시간 설정 후 다른 건이 나중에 확정되는 순서도 있으므로 확정 시점 재검사가 필수).
--
-- 겹침은 이 proposal의 광고주·인플루언서 중 누구든 겹치면 막는다(양쪽 다 이중예약 방지 대상).

begin;

create or replace function set_proposal_time(
  p_proposal_id  uuid,
  p_by_id        uuid,
  p_start_at     timestamptz,
  p_duration_min int
) returns void
language plpgsql
security definer
as $$
declare
  v_advertiser uuid;
  v_influencer uuid;
  v_duration   int;
  v_conflict   record;
begin
  select advertiser_id, influencer_id into v_advertiser, v_influencer
  from proposals where id = p_proposal_id;

  if v_advertiser is null then
    raise exception 'proposal not found' using errcode = 'P0002';
  end if;
  if p_by_id <> v_advertiser and p_by_id <> v_influencer then
    raise exception 'not a party' using errcode = 'P0010';
  end if;

  v_duration := greatest(coalesce(p_duration_min, 60), 60);

  select p.start_at into v_conflict
  from proposals p
  where p.id <> p_proposal_id
    and p.advertiser_confirmed and p.influencer_confirmed
    and p.start_at is not null
    and (p.advertiser_id in (v_advertiser, v_influencer) or p.influencer_id in (v_advertiser, v_influencer))
    and p.start_at < (p_start_at + (v_duration || ' minutes')::interval)
    and (p.start_at + (coalesce(p.duration_min, 60) || ' minutes')::interval) > p_start_at
  limit 1;

  if found then
    raise exception 'time_overlap:%', to_char(v_conflict.start_at, 'MM/DD HH24:MI') using errcode = 'P0017';
  end if;

  update proposals set start_at = p_start_at, duration_min = v_duration where id = p_proposal_id;

  insert into notifications (user_id, type, kind, title, body, ref_type, ref_id, state)
  values (
    case when p_by_id = v_advertiser then v_influencer else v_advertiser end,
    'time_proposed', 'time_proposed', '협업 시간이 설정됐어요',
    to_char(p_start_at, 'MM/DD HH24:MI') || ' · ' || v_duration || '분',
    'proposal', p_proposal_id, 'unread'
  );
end;
$$;

create index if not exists proposals_time_overlap_idx
  on proposals(advertiser_id, influencer_id, start_at)
  where advertiser_confirmed = true and influencer_confirmed = true and start_at is not null;

revoke execute on function set_proposal_time(uuid, uuid, timestamptz, int) from public, anon, authenticated;
grant  execute on function set_proposal_time(uuid, uuid, timestamptz, int) to service_role;

commit;
