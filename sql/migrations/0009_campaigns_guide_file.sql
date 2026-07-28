-- 0009  캠페인 가이드 파일 (PDF·워드·한글 등)
-- 관련: src/app/(dashboard)/advertiser/campaigns/new/page.tsx (가이드 파일 업로드)

alter table campaigns
  add column if not exists guide_url  text,   -- 업로드된 가이드 파일 공개 URL
  add column if not exists guide_name text;    -- 원본 파일명

-- 가이드 파일 저장용 Storage 버킷 (공개)
insert into storage.buckets (id, name, public)
values ('campaign-guides', 'campaign-guides', true)
on conflict (id) do nothing;

-- 업로드: 인증 사용자 / 삭제: 인증 사용자 / 읽기: 공개(버킷 public=true)
do $$ begin
  create policy "campaign_guides_insert" on storage.objects
    for insert to authenticated with check (bucket_id = 'campaign-guides');
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "campaign_guides_delete" on storage.objects
    for delete to authenticated using (bucket_id = 'campaign-guides');
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "campaign_guides_read" on storage.objects
    for select using (bucket_id = 'campaign-guides');
exception when duplicate_object then null; end $$;
