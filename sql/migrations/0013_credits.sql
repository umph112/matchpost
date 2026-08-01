-- 0013  크레딧 시스템 — credits 테이블 + 트랜잭션 원장 + Postgres 함수 + 자동 차감 트리거
-- 1 크레딧 = 1원 (향후 충전 상품으로 연결 예정)
-- 트리거가 insert 시 서버사이드에서 원자적으로 차감 → 클라이언트 우회 불가

-- ── 테이블 ──────────────────────────────────────────────────

create table if not exists credits (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  balance    bigint not null default 0,
  updated_at timestamptz default now()
);

create table if not exists credit_transactions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  amount       bigint not null,    -- 양수=지급, 음수=소비
  action       text not null,      -- 'welcome_advertiser'|'welcome_influencer'|'campaign_open'|'schedule_open'|'dash_send'|'campaign_made'|'admin_grant'|'admin_deduct'
  reference_id text,               -- campaign_id / schedule_id / proposal_id 등
  description  text,
  created_at   timestamptz default now()
);

create index if not exists credit_transactions_user_idx on credit_transactions(user_id, created_at desc);

-- 관리자 플래그 (is_admin=true 인 계정만 /admin/* 접근 가능)
alter table profiles add column if not exists is_admin boolean not null default false;

-- ── RLS ──────────────────────────────────────────────────────

alter table credits enable row level security;
alter table credit_transactions enable row level security;

-- 본인 잔액만 조회 가능
drop policy if exists "credits_own_select" on credits;
create policy "credits_own_select" on credits
  for select using (auth.uid() = user_id);

-- 본인 이력만 조회 가능
drop policy if exists "credit_transactions_own_select" on credit_transactions;
create policy "credit_transactions_own_select" on credit_transactions
  for select using (auth.uid() = user_id);

-- INSERT/UPDATE는 service_role(트리거·API)만 허용 — RLS 정책 없으면 일반 유저 불가

-- ── 핵심 함수 ─────────────────────────────────────────────────

-- grant_credits: 크레딧 지급 (환영 크레딧·메이드 보너스·관리자 수동 지급)
create or replace function grant_credits(
  p_user_id    uuid,
  p_amount     bigint,
  p_action     text,
  p_reference_id text default null,
  p_description  text default null
) returns void language plpgsql security definer as $$
begin
  insert into credits (user_id, balance, updated_at)
  values (p_user_id, p_amount, now())
  on conflict (user_id)
  do update set balance = credits.balance + p_amount, updated_at = now();

  insert into credit_transactions (user_id, amount, action, reference_id, description)
  values (p_user_id, p_amount, p_action, p_reference_id, p_description);
end;
$$;

-- deduct_credits: 크레딧 차감 (현재는 음수 허용 — 향후 유료 전환 시 잔액 검사로 교체)
create or replace function deduct_credits(
  p_user_id    uuid,
  p_amount     bigint,
  p_action     text,
  p_reference_id text default null,
  p_description  text default null
) returns void language plpgsql security definer as $$
begin
  -- 기존 행 없으면 0으로 초기화 후 차감
  insert into credits (user_id, balance, updated_at)
  values (p_user_id, 0, now())
  on conflict (user_id) do nothing;

  update credits
  set balance = balance - p_amount, updated_at = now()
  where user_id = p_user_id;

  insert into credit_transactions (user_id, amount, action, reference_id, description)
  values (p_user_id, -p_amount, p_action, p_reference_id, p_description);
end;
$$;

-- ── 자동 차감 트리거 ──────────────────────────────────────────

-- 1. 캠페인 오픈 → 광고주 5,000 차감
create or replace function trg_fn_campaign_open()
returns trigger language plpgsql security definer as $$
begin
  perform deduct_credits(new.advertiser_id, 5000, 'campaign_open', new.id::text, '캠페인 오픈');
  return new;
end;
$$;

drop trigger if exists trg_campaign_open on campaigns;
create trigger trg_campaign_open
after insert on campaigns
for each row execute function trg_fn_campaign_open();

-- 2. 오픈(schedule) 공개 등록 → 인플루언서 1,000 차감
create or replace function trg_fn_schedule_open()
returns trigger language plpgsql security definer as $$
begin
  if new.is_public then
    perform deduct_credits(new.influencer_id, 1000, 'schedule_open', new.id::text, '오픈 등록');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_schedule_open on schedules;
create trigger trg_schedule_open
after insert on schedules
for each row execute function trg_fn_schedule_open();

-- 3. 대시(proposal) 발송 → 광고주 100 차감
create or replace function trg_fn_dash_send()
returns trigger language plpgsql security definer as $$
begin
  perform deduct_credits(new.advertiser_id, 100, 'dash_send', new.id::text, '대시 발송');
  return new;
end;
$$;

drop trigger if exists trg_dash_send on proposals;
create trigger trg_dash_send
after insert on proposals
for each row execute function trg_fn_dash_send();

-- 4. 양쪽 확정 완료(메이드) → 광고주 10,000 지급
create or replace function trg_fn_campaign_made()
returns trigger language plpgsql security definer as $$
begin
  -- 이번 업데이트로 처음으로 양쪽 확정이 된 경우에만 발동
  if new.advertiser_confirmed = true
     and new.influencer_confirmed = true
     and (old.advertiser_confirmed = false or old.influencer_confirmed = false) then
    perform grant_credits(new.advertiser_id, 10000, 'campaign_made', new.id::text, '캠페인 메이드 보너스');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_campaign_made on proposals;
create trigger trg_campaign_made
after update on proposals
for each row execute function trg_fn_campaign_made();
