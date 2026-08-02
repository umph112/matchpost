-- 0018  크레딧 원장(credit_ledger) — append-only. 잔액은 뷰로 파생, 숫자 컬럼 증감 금지.
-- IMPLEMENT-1-SCHEMA.md 1번 항목. 0013_credits.sql(잔액 캐시 컬럼 + 트리거 증감)을 완전 교체한다.
-- wallet('free'|'paid')과 expires_at은 지금 당장 쓰이지 않아도 스키마에 넣는다 — 나중에 넣으면
-- 과거 데이터에 소급 적용이 불가능해지는 필드들이기 때문.

begin;

-- ── 1. 신규 테이블 ────────────────────────────────────────────

create table if not exists credit_ledger (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  delta        int  not null,                 -- 지급 +, 차감 −
  wallet       text not null check (wallet in ('free', 'paid')),
  kind         text not null check (kind in (
                 'welcome', 'reward', 'charge', 'refund', 'purchase', 'penalty', 'decay', 'admin'
               )),
  reason_code  text not null,                 -- 'open_schedule' | 'create_campaign' | 'send_proposal' |
                                               -- 'unlock_profile' | 'welcome' | 'profile_complete' |
                                               -- 'first_action' | 'encourage' | 'celebrate' | 'deal_complete' |
                                               -- 'review' | 'invite' | 'visit_weekly' | 'visit_monthly' |
                                               -- 'comeback' | 'dormant_14' | 'dormant_30' |
                                               -- 'admin_grant' | 'admin_deduct' | 'migration' 등
  ref_type     text check (ref_type is null or ref_type in (
                 'schedule', 'campaign', 'proposal', 'deal', 'review', 'invite'
               )),
  ref_id       uuid,
  memo         text,                          -- 관리자 내부 메모. 유저에게 노출 안 함
  admin_id     uuid references auth.users(id),-- kind='admin' 일 때만
  expires_at   timestamptz,                   -- ⚠️ 현재 정책상 항상 null
  created_at   timestamptz not null default now()
);

create index if not exists credit_ledger_user_idx on credit_ledger(user_id, created_at desc);
create index if not exists credit_ledger_user_wallet_idx on credit_ledger(user_id, wallet);
create index if not exists credit_ledger_reason_idx on credit_ledger(user_id, reason_code);

alter table credit_ledger enable row level security;

drop policy if exists "credit_ledger_own_select" on credit_ledger;
create policy "credit_ledger_own_select" on credit_ledger
  for select using (auth.uid() = user_id);
-- insert/update/delete는 정책 없음 = 일반 유저 불가. 아래 security definer 함수로만 기록된다.


create table if not exists user_visit_log (
  user_id    uuid not null references auth.users(id) on delete cascade,
  visited_on date not null,
  primary key (user_id, visited_on)
);

alter table user_visit_log enable row level security;

drop policy if exists "user_visit_log_own_select" on user_visit_log;
create policy "user_visit_log_own_select" on user_visit_log
  for select using (auth.uid() = user_id);


-- ── 2. 기존 credits 잔액 이관 (0013 credits 테이블이 있을 때만) ───

do $$
begin
  if to_regclass('public.credits') is not null then
    insert into credit_ledger (user_id, delta, wallet, kind, reason_code, memo)
    select user_id, balance, 'free', 'admin', 'migration', '0013 credits 시스템 잔액 이관'
    from credits
    where balance <> 0;

    -- 이관 검증: 유저별 새 잔액 합 == 구 balance. 하나라도 다르면 전체 롤백.
    if exists (
      select 1
      from credits c
      left join (
        select user_id, sum(delta) as bal from credit_ledger group by user_id
      ) l on l.user_id = c.user_id
      where coalesce(l.bal, 0) <> c.balance
    ) then
      raise exception 'credit_ledger migration mismatch — 이관 후 잔액이 일치하지 않습니다';
    end if;
  end if;
end $$;


-- ── 3. 구 시스템 제거 (잔액 이관 완료 후) ─────────────────────────

drop trigger if exists trg_campaign_open on campaigns;
drop trigger if exists trg_schedule_open on schedules;
drop trigger if exists trg_dash_send on proposals;
drop trigger if exists trg_campaign_made on proposals;

drop function if exists trg_fn_campaign_open();
drop function if exists trg_fn_schedule_open();
drop function if exists trg_fn_dash_send();
drop function if exists trg_fn_campaign_made();

drop function if exists grant_credits(uuid, bigint, text, text, text);
drop function if exists deduct_credits(uuid, bigint, text, text, text);

drop table if exists credit_transactions;
drop table if exists credits;


-- ── 4. 잔액 뷰 (합계로 파생 — 캐시 컬럼 없음) ──────────────────────

create or replace view credit_balances as
select
  user_id,
  coalesce(sum(delta) filter (where wallet = 'free'), 0) as free_balance,
  coalesce(sum(delta) filter (where wallet = 'paid'), 0) as paid_balance,
  coalesce(sum(delta), 0) as balance
from credit_ledger
group by user_id;


-- ── 5. 핵심 함수 (모두 security definer + 유저별 advisory lock으로 직렬화) ─

-- 차감: free 지갑 우선 소진, 부족분만 paid. 총 보유액보다 크면 예외 → 호출 트랜잭션 전체 롤백.
-- p_kind 기본값은 'charge'(일반 액션 차감). 관리자 수동 차감(admin_deduct)만 'admin'으로 넘긴다.
create or replace function credit_ledger_charge(
  p_user_id     uuid,
  p_amount      int,
  p_reason_code text,
  p_ref_type    text default null,
  p_ref_id      uuid default null,
  p_memo        text default null,
  p_kind        text default 'charge'
) returns void language plpgsql security definer as $$
declare
  v_free      bigint;
  v_paid      bigint;
  v_free_take int;
  v_paid_take int;
begin
  if p_amount <= 0 then
    raise exception 'credit_ledger_charge: amount must be positive';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_user_id::text));

  select coalesce(sum(delta) filter (where wallet = 'free'), 0),
         coalesce(sum(delta) filter (where wallet = 'paid'), 0)
    into v_free, v_paid
    from credit_ledger where user_id = p_user_id;

  if v_free + v_paid < p_amount then
    raise exception 'insufficient_credit' using errcode = 'P0001';
  end if;

  v_free_take := least(greatest(v_free, 0), p_amount);
  v_paid_take := p_amount - v_free_take;

  if v_free_take > 0 then
    insert into credit_ledger (user_id, delta, wallet, kind, reason_code, ref_type, ref_id, memo)
    values (p_user_id, -v_free_take, 'free', p_kind, p_reason_code, p_ref_type, p_ref_id, p_memo);
  end if;

  if v_paid_take > 0 then
    insert into credit_ledger (user_id, delta, wallet, kind, reason_code, ref_type, ref_id, memo)
    values (p_user_id, -v_paid_take, 'paid', p_kind, p_reason_code, p_ref_type, p_ref_id, p_memo);
  end if;
end;
$$;

-- 지급: welcome/reward/purchase/admin. 유상 충전이 아직 없으므로 전부 free 지갑에 쌓인다.
create or replace function credit_ledger_grant(
  p_user_id     uuid,
  p_amount      int,
  p_kind        text,
  p_reason_code text,
  p_ref_type    text default null,
  p_ref_id      uuid default null,
  p_memo        text default null,
  p_admin_id    uuid default null
) returns void language plpgsql security definer as $$
begin
  if p_amount <= 0 then
    raise exception 'credit_ledger_grant: amount must be positive';
  end if;

  insert into credit_ledger (user_id, delta, wallet, kind, reason_code, ref_type, ref_id, memo, admin_id)
  values (p_user_id, p_amount, 'free', p_kind, p_reason_code, p_ref_type, p_ref_id, p_memo, p_admin_id);
end;
$$;

-- 환불: 반대 부호의 새 행. 기존 행은 손대지 않는다.
create or replace function credit_ledger_refund(
  p_user_id     uuid,
  p_amount      int,
  p_reason_code text,
  p_ref_type    text default null,
  p_ref_id      uuid default null,
  p_memo        text default null
) returns void language plpgsql security definer as $$
begin
  if p_amount <= 0 then
    raise exception 'credit_ledger_refund: amount must be positive';
  end if;

  insert into credit_ledger (user_id, delta, wallet, kind, reason_code, ref_type, ref_id, memo)
  values (p_user_id, p_amount, 'free', 'refund', p_reason_code, p_ref_type, p_ref_id, p_memo);
end;
$$;

-- 페널티: 확정 후 취소 시 취소한 쪽에만. 무상 지갑만 차감 — 유상 지갑은 어떤 경우에도 건드리지 않는다.
create or replace function credit_ledger_penalty(
  p_user_id     uuid,
  p_amount      int,
  p_reason_code text,
  p_ref_type    text default null,
  p_ref_id      uuid default null,
  p_memo        text default null
) returns void language plpgsql security definer as $$
begin
  if p_amount <= 0 then
    raise exception 'credit_ledger_penalty: amount must be positive';
  end if;

  insert into credit_ledger (user_id, delta, wallet, kind, reason_code, ref_type, ref_id, memo)
  values (p_user_id, -p_amount, 'free', 'penalty', p_reason_code, p_ref_type, p_ref_id, p_memo);
end;
$$;

-- 휴면 차감(배치용): 하한 5,000C, dormant_14는 평생 1회, dormant_30은 30일마다 반복.
-- 반환값 true = 실제로 차감함(호출부가 예고 알림 등을 판단할 때 사용).
create or replace function credit_ledger_decay(
  p_user_id     uuid,
  p_reason_code text,   -- 'dormant_14' | 'dormant_30'
  p_amount      int
) returns boolean language plpgsql security definer as $$
declare
  v_free bigint;
  v_last_at timestamptz;
begin
  perform pg_advisory_xact_lock(hashtext(p_user_id::text));

  select coalesce(sum(delta) filter (where wallet = 'free'), 0)
    into v_free
    from credit_ledger where user_id = p_user_id;

  if v_free <= 5000 then
    return false;
  end if;

  if p_reason_code = 'dormant_14' then
    if exists (
      select 1 from credit_ledger where user_id = p_user_id and reason_code = 'dormant_14'
    ) then
      return false;
    end if;
  elsif p_reason_code = 'dormant_30' then
    select max(created_at) into v_last_at
      from credit_ledger where user_id = p_user_id and reason_code = 'dormant_30';
    if v_last_at is not null and v_last_at > now() - interval '30 days' then
      return false;
    end if;
  end if;

  insert into credit_ledger (user_id, delta, wallet, kind, reason_code)
  values (p_user_id, -p_amount, 'free', 'decay', p_reason_code);

  return true;
end;
$$;


-- ── 6. 이벤트 트리거 (기존 0013의 4개 훅을 새 reason_code/금액으로 이관) ───

-- 캠페인 생성 → 광고주 5,000 차감 + 500 응원 지급
create or replace function trg_fn_credit_campaign_open()
returns trigger language plpgsql security definer as $$
begin
  perform credit_ledger_charge(new.advertiser_id, 5000, 'create_campaign', 'campaign', new.id, '캠페인 등록');
  perform credit_ledger_grant(new.advertiser_id, 500, 'reward', 'encourage', 'campaign', new.id, '캠페인 등록 응원 크레딧');
  return new;
end;
$$;

drop trigger if exists trg_credit_campaign_open on campaigns;
create trigger trg_credit_campaign_open
after insert on campaigns
for each row execute function trg_fn_credit_campaign_open();

-- 오픈(schedule) 공개 등록 → 인플루언서 1,000 차감 + 500 응원 지급
create or replace function trg_fn_credit_schedule_open()
returns trigger language plpgsql security definer as $$
begin
  if new.is_public then
    perform credit_ledger_charge(new.influencer_id, 1000, 'open_schedule', 'schedule', new.id, '오픈 등록');
    perform credit_ledger_grant(new.influencer_id, 500, 'reward', 'encourage', 'schedule', new.id, '오픈 등록 응원 크레딧');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_credit_schedule_open on schedules;
create trigger trg_credit_schedule_open
after insert on schedules
for each row execute function trg_fn_credit_schedule_open();

-- 대시(proposal) 발송 → 광고주 500 차감
create or replace function trg_fn_credit_dash_send()
returns trigger language plpgsql security definer as $$
begin
  perform credit_ledger_charge(new.advertiser_id, 500, 'send_proposal', 'proposal', new.id, '대시 발송');
  return new;
end;
$$;

drop trigger if exists trg_credit_dash_send on proposals;
create trigger trg_credit_dash_send
after insert on proposals
for each row execute function trg_fn_credit_dash_send();

-- 양쪽 확정(메이드) → 광고주·인플루언서 각 2,000 지급 (celebrate)
create or replace function trg_fn_credit_deal_celebrate()
returns trigger language plpgsql security definer as $$
begin
  if new.advertiser_confirmed = true and new.influencer_confirmed = true
     and (coalesce(old.advertiser_confirmed, false) = false or coalesce(old.influencer_confirmed, false) = false) then
    perform credit_ledger_grant(new.advertiser_id, 2000, 'reward', 'celebrate', 'proposal', new.id, '협업 성사 축하 크레딧');
    perform credit_ledger_grant(new.influencer_id, 2000, 'reward', 'celebrate', 'proposal', new.id, '협업 성사 축하 크레딧');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_credit_deal_celebrate on proposals;
create trigger trg_credit_deal_celebrate
after update on proposals
for each row execute function trg_fn_credit_deal_celebrate();

commit;
