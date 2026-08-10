-- 0065  대화(conversations) 도입 — IMPLEMENT-6-DELTA.md A절
--
-- 지금까지 "대화"는 실체가 없었다(sender/receiver 쌍으로 messages를 묶어 화면에서만 파생).
-- A1(캠페인 1:N vs 개인 1:1 구분), A5(대화별 담당자)를 지원하려면 대화 자체가 행이 필요하다.
-- 기존 메시지는 백필하지 않는다(D5 때 정한 원칙과 동일) — /advertiser/messages/[id] 라우트가
-- 처음 열릴 때 get_or_create_conversation()으로 그 자리에서 만든다.
--
-- 캠페인 대화(kind='campaign')는 광고주 1명 + 그 campaign_id의 proposals가 있는 인플루언서 전원이
-- 참여자다(별도 참여자 테이블 없이 proposals.campaign_id로 파생). 개인 대화(kind='personal')는
-- schedule_id 기반이거나 campaign_id 없는 proposals의 (advertiser_id, other_id) 쌍이다.

begin;

create table if not exists conversations (
  id            uuid primary key default gen_random_uuid(),
  advertiser_id uuid not null references profiles(id) on delete cascade,
  kind          text not null check (kind in ('campaign', 'personal')),
  campaign_id   uuid references campaigns(id) on delete cascade,
  other_id      uuid references profiles(id) on delete cascade,
  manager_id    uuid references profiles(id),
  created_at    timestamptz not null default now(),
  check (
    (kind = 'campaign' and campaign_id is not null and other_id is null) or
    (kind = 'personal' and other_id is not null and campaign_id is null)
  )
);

create unique index if not exists conversations_campaign_uidx
  on conversations(advertiser_id, campaign_id) where kind = 'campaign';
create unique index if not exists conversations_personal_uidx
  on conversations(advertiser_id, other_id) where kind = 'personal';

alter table conversations enable row level security;

drop policy if exists "conversation parties can read" on conversations;
create policy "conversation parties can read" on conversations for select
  using (
    auth.uid() = advertiser_id
    or auth.uid() = other_id
    or (kind = 'campaign' and exists (
      select 1 from proposals p where p.campaign_id = conversations.campaign_id and p.influencer_id = auth.uid()
    ))
  );

-- 대화 목록/입장 시 없으면 그 자리에서 만든다(백필 대신 지연 생성)
create or replace function get_or_create_conversation(
  p_advertiser_id uuid,
  p_kind          text,
  p_campaign_id   uuid,
  p_other_id      uuid
) returns uuid
language plpgsql
security definer
as $$
declare
  v_id uuid;
begin
  if p_kind = 'campaign' then
    select id into v_id from conversations where advertiser_id = p_advertiser_id and campaign_id = p_campaign_id;
    if v_id is null then
      insert into conversations (advertiser_id, kind, campaign_id) values (p_advertiser_id, 'campaign', p_campaign_id)
      returning id into v_id;
    end if;
  else
    select id into v_id from conversations where advertiser_id = p_advertiser_id and other_id = p_other_id;
    if v_id is null then
      insert into conversations (advertiser_id, kind, other_id) values (p_advertiser_id, 'personal', p_other_id)
      returning id into v_id;
    end if;
  end if;
  return v_id;
end;
$$;

revoke execute on function get_or_create_conversation(uuid, text, uuid, uuid) from public, anon;
grant  execute on function get_or_create_conversation(uuid, text, uuid, uuid) to authenticated, service_role;

-- messages: 캠페인 대화 브로드캐스트/개별발송/시스템줄/대리발송/날짜제안 카드 지원
alter table messages
  add column if not exists broadcast_id   uuid,
  add column if not exists targeted_only  boolean not null default false,
  add column if not exists is_system      boolean not null default false,
  add column if not exists proxy          boolean not null default false,
  add column if not exists proposed_date  date;

-- proposals: 날짜 제안(수락 전 대기 상태) — 수락되면 start_at으로 옮기고 비운다(A7)
alter table proposals
  add column if not exists proposed_date date,
  add column if not exists proposed_by   uuid references profiles(id);

commit;
