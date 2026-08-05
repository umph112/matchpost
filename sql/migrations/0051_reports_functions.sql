-- 0051  신고(reports) 서버 함수 — 접수·해결·재오픈·관리자종결/이관·자동종결 배치
--
-- 문서 요구사항: source_type·source_id·counterpart_id·stage·snapshot는 서버가 채운다
-- (사용자는 type·body만 입력) — proposal_id만 받아 서버에서 상대방·단계·조건 스냅샷을 직접 조회해
-- 클라이언트가 임의로 counterpart_id/snapshot을 조작할 수 없게 한다.
--
-- 캠페인 단위 신고(source_type='campaign')는 counterpart를 campaigns.advertiser_id로 보고
-- 신고자가 그 광고주 본인이 아니면 허용한다(실제로는 proposal 기반 신고가 대부분일 것으로 예상 —
-- 캠페인 신고는 특정 proposal 없이도 가능하게 열어만 둠, 간단한 검증만 적용).

begin;

create or replace function file_report(
  p_reporter_id uuid,
  p_source_type text,
  p_source_id   uuid,
  p_type        text,
  p_body        text
) returns uuid
language plpgsql
security definer
as $$
declare
  v_counterpart_id uuid;
  v_stage    text;
  v_snapshot jsonb;
  v_report_id uuid;
begin
  if p_source_type = 'proposal' then
    select
      case when advertiser_id = p_reporter_id then influencer_id
           when influencer_id = p_reporter_id then advertiser_id
           else null end,
      stage,
      jsonb_build_object(
        'budget', budget,
        'date', date,
        'payment_due_date', payment_due_date,
        'settled_at', settled_at,
        'advertiser_confirmed', advertiser_confirmed,
        'influencer_confirmed', influencer_confirmed
      )
    into v_counterpart_id, v_stage, v_snapshot
    from proposals where id = p_source_id;

  elsif p_source_type = 'campaign' then
    select advertiser_id, null::text,
      jsonb_build_object('title', title, 'budget_total', budget_total, 'date', date)
    into v_counterpart_id, v_stage, v_snapshot
    from campaigns where id = p_source_id;

    if v_counterpart_id = p_reporter_id then
      raise exception 'cannot report own campaign' using errcode = 'P0008';
    end if;

  else
    raise exception 'invalid source_type' using errcode = 'P0009';
  end if;

  if v_counterpart_id is null then
    raise exception 'reporter is not a party to this source' using errcode = 'P0010';
  end if;

  insert into reports (reporter_id, counterpart_id, source_type, source_id, type, body, stage, snapshot)
  values (p_reporter_id, v_counterpart_id, p_source_type, p_source_id, p_type, p_body, v_stage, v_snapshot)
  returning id into v_report_id;

  -- 접수 즉시 양쪽에 알림 — 몰래 신고 구조 금지
  insert into notifications (user_id, type, kind, title, body, ref_type, ref_id, state)
  values
    (p_reporter_id, 'report_filed', 'report_filed', '신고가 접수됐어요',
     '운영팀이 검토 중이에요.', 'report', v_report_id, 'unread'),
    (v_counterpart_id, 'report_received', 'report_received', '신고가 접수됐어요',
     '상대방이 운영팀에 알렸어요.', 'report', v_report_id, 'unread');

  return v_report_id;
end;
$$;


create or replace function resolve_report(p_report_id uuid, p_reporter_id uuid)
returns void language plpgsql security definer as $$
begin
  update reports
  set status = 'resolved', closed_by = p_reporter_id, closed_at = now()
  where id = p_report_id and reporter_id = p_reporter_id and status = 'open';
  if not found then
    raise exception 'not found or not open' using errcode = 'P0011';
  end if;
end;
$$;


create or replace function reopen_report(p_report_id uuid, p_reporter_id uuid)
returns void language plpgsql security definer as $$
begin
  update reports
  set status = 'open', closed_by = null, close_reason = null, closed_at = null
  where id = p_report_id and reporter_id = p_reporter_id
    and status in ('resolved', 'closed') and closed_at > now() - interval '7 days';
  if not found then
    raise exception 'cannot reopen' using errcode = 'P0013';
  end if;
end;
$$;


create or replace function admin_close_report(p_report_id uuid, p_admin_id uuid, p_close_reason text)
returns void language plpgsql security definer as $$
begin
  if p_close_reason is null or length(trim(p_close_reason)) = 0 then
    raise exception 'close_reason required' using errcode = 'P0012';
  end if;
  update reports
  set status = 'closed', closed_by = p_admin_id, close_reason = p_close_reason, closed_at = now()
  where id = p_report_id and status = 'open';
  if not found then
    raise exception 'not found or not open' using errcode = 'P0011';
  end if;
end;
$$;


create or replace function admin_escalate_report(p_report_id uuid, p_admin_id uuid)
returns void language plpgsql security definer as $$
begin
  update reports
  set status = 'escalated', closed_by = p_admin_id, closed_at = now()
  where id = p_report_id and status = 'open';
  if not found then
    raise exception 'not found or not open' using errcode = 'P0011';
  end if;
end;
$$;


-- 14일 무진전 자동 종결, 7일차 1회 리마인드
create or replace function run_report_autoclose_batch()
returns table(report_id uuid, action text)
language plpgsql
security definer
as $$
declare
  r record;
begin
  for r in select id, reporter_id, created_at from reports where status = 'open' loop
    if r.created_at <= now() - interval '7 days' and r.created_at > now() - interval '8 days' then
      if not exists (select 1 from notifications where notification_group = 'report_reminder:' || r.id) then
        insert into notifications (user_id, type, kind, title, body, ref_type, ref_id, state, notification_group)
        values (r.reporter_id, 'report_reminder', 'report_reminder',
          '신고가 아직 처리 중이에요', '7일째 진전이 없어요. 해결되셨다면 닫아주세요.',
          'report', r.id, 'unread', 'report_reminder:' || r.id);
      end if;
      report_id := r.id; action := 'reminder_7d'; return next;
    elsif r.created_at <= now() - interval '14 days' then
      update reports
      set status = 'closed', close_reason = '자동 종결(14일 무진전)', closed_at = now()
      where id = r.id;
      report_id := r.id; action := 'autoclosed_14d'; return next;
    end if;
  end loop;
end;
$$;


-- 조회 패턴 인덱스
create index if not exists reports_reporter_idx on reports(reporter_id, status);
create index if not exists reports_counterpart_idx on reports(counterpart_id, status);
create index if not exists reports_status_created_idx on reports(status, created_at);


-- 0046~0050과 같은 이유로 실행권한 잠금 — service_role 경로(TS 서버 액션)로만 호출
revoke execute on function file_report(uuid, text, uuid, text, text) from public, anon, authenticated;
grant  execute on function file_report(uuid, text, uuid, text, text) to service_role;

revoke execute on function resolve_report(uuid, uuid) from public, anon, authenticated;
grant  execute on function resolve_report(uuid, uuid) to service_role;

revoke execute on function reopen_report(uuid, uuid) from public, anon, authenticated;
grant  execute on function reopen_report(uuid, uuid) to service_role;

revoke execute on function admin_close_report(uuid, uuid, text) from public, anon, authenticated;
grant  execute on function admin_close_report(uuid, uuid, text) to service_role;

revoke execute on function admin_escalate_report(uuid, uuid) from public, anon, authenticated;
grant  execute on function admin_escalate_report(uuid, uuid) to service_role;

revoke execute on function run_report_autoclose_batch() from public, anon, authenticated;
grant  execute on function run_report_autoclose_batch() to service_role;

commit;
