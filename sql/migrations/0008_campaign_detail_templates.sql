-- 0008  캠페인 상세 내용 저장 양식 (광고주별 재사용)
-- 관련: src/app/(dashboard)/advertiser/campaigns/new/page.tsx (상세 내용 저장/불러오기)

create table if not exists campaign_detail_templates (
  id            uuid primary key default gen_random_uuid(),
  advertiser_id uuid not null references auth.users(id) on delete cascade,
  name          text not null,
  content       text not null default '',
  created_at    timestamptz not null default now()
);

alter table campaign_detail_templates enable row level security;

do $$ begin
  create policy "detail_tpl_select_own" on campaign_detail_templates for select using (auth.uid() = advertiser_id);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "detail_tpl_insert_own" on campaign_detail_templates for insert with check (auth.uid() = advertiser_id);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "detail_tpl_delete_own" on campaign_detail_templates for delete using (auth.uid() = advertiser_id);
exception when duplicate_object then null; end $$;
