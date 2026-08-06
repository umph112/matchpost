-- 0060  정산 화면(/advertiser/settlements) 지원 — IMPLEMENT-5-DELTA.md B절, SPEC-B-SETTLE.md 화면11
--
-- B1: 세무자료 미수령이 남으면 정산 기록 CTA를 잠그되, 그 자리에서 "세무자료 N명 요청하기"를 띄운다.
--     캠페인 단위로 한 번 보내면 "요청 보냄 · 대기"로 바뀌어야 하므로 campaigns에 타임스탬프 추가.
-- B4: "사유 해결 표시"는 기록만 — 실제 재정산(reSettleCampaign)과는 분리된 가벼운 감사기록이다.
--     나중에 관리자 크레딧 지급 등에도 재사용할 수 있게 범용 audit_log 테이블로 만든다.

begin;

alter table campaigns
  add column if not exists tax_doc_requested_at timestamptz;

create table if not exists audit_log (
  id         uuid primary key default gen_random_uuid(),
  actor_id   uuid references profiles(id),
  action     text not null,       -- 'settlement_dispute_resolved' 등
  target_type text not null,      -- 'campaign' | 'proposal' | ...
  target_id  uuid not null,
  note       text,
  created_at timestamptz not null default now()
);

create index if not exists audit_log_target_idx on audit_log(target_type, target_id);

-- B1: 세무자료 일괄 요청 — 대상 캠페인의 미수령 인플루언서 전원에게 알림 + 캠페인에 요청시각 기록
create or replace function request_tax_docs(p_campaign_id uuid, p_by_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_advertiser uuid;
  v_title text;
begin
  select advertiser_id, title into v_advertiser, v_title from campaigns where id = p_campaign_id;
  if v_advertiser is null then
    raise exception 'campaign not found' using errcode = 'P0002';
  end if;
  if p_by_id <> v_advertiser then
    raise exception 'not the campaign owner' using errcode = 'P0010';
  end if;

  insert into notifications (user_id, type, kind, title, body, ref_type, ref_id, state)
  select
    influencer_id, 'tax_doc_request', 'tax_doc_request',
    '세무자료를 보내주세요',
    v_title || ' 정산을 위해 세무자료가 필요해요. 대시에서 전달해주세요.',
    'campaign', p_campaign_id, 'unread'
  from proposals
  where campaign_id = p_campaign_id
    and tax_doc_type is not null
    and coalesce(tax_doc_received, false) = false;

  update campaigns set tax_doc_requested_at = now() where id = p_campaign_id;
end;
$$;

-- B4: 보류 사유 해결 표시 — 기록만 남긴다(재정산 자체는 딜시트에서 reSettleCampaign으로 별도 진행)
create or replace function resolve_settlement_dispute(p_campaign_id uuid, p_by_id uuid, p_note text)
returns void
language plpgsql
security definer
as $$
declare
  v_advertiser uuid;
begin
  select advertiser_id into v_advertiser from campaigns where id = p_campaign_id;
  if v_advertiser is null then
    raise exception 'campaign not found' using errcode = 'P0002';
  end if;
  if p_by_id <> v_advertiser then
    raise exception 'not the campaign owner' using errcode = 'P0010';
  end if;

  insert into audit_log (actor_id, action, target_type, target_id, note)
  values (p_by_id, 'settlement_dispute_resolved', 'campaign', p_campaign_id, p_note);
end;
$$;

revoke execute on function request_tax_docs(uuid, uuid) from public, anon, authenticated;
grant  execute on function request_tax_docs(uuid, uuid) to service_role;

revoke execute on function resolve_settlement_dispute(uuid, uuid, text) from public, anon, authenticated;
grant  execute on function resolve_settlement_dispute(uuid, uuid, text) to service_role;

commit;
