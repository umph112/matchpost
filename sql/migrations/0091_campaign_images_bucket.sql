-- 0091  캠페인 이미지 Storage 버킷 (campaign-images)
--
-- 코드는 처음부터 이 버킷에 올리고 있었는데 버킷이 만들어진 적이 없었다.
--   src/app/(dashboard)/advertiser/campaigns/new/page.tsx  uploadImages()
--     storage.from('campaign-images').upload(`${user.id}/${...}`, file, { upsert: true })
--     storage.from('campaign-images').getPublicUrl(path)
-- 컬럼(campaigns.image_urls / cover_image_url)은 0011에 이미 있어서, 캠페인 등록 시
-- 이미지를 붙이면 업로드 단계에서 "이미지 업로드 실패"로 끊겼다.
--
-- 설정은 기존 campaign-guides(0009)와 동일하게 맞춘다 — public=true, 용량·MIME 제한 없음.
-- 이미 적용된 DB에서 다시 돌려도 안전하다(on conflict do nothing + duplicate_object 무시).

insert into storage.buckets (id, name, public)
values ('campaign-images', 'campaign-images', true)
on conflict (id) do nothing;

-- 업로드: 인증 사용자 / 삭제: 인증 사용자 / 읽기: 공개(버킷 public=true)
do $$ begin
  create policy "campaign_images_insert" on storage.objects
    for insert to authenticated with check (bucket_id = 'campaign-images');
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "campaign_images_delete" on storage.objects
    for delete to authenticated using (bucket_id = 'campaign-images');
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "campaign_images_read" on storage.objects
    for select using (bucket_id = 'campaign-images');
exception when duplicate_object then null; end $$;

-- 코드가 upsert: true 로 올린다. 같은 경로에 다시 쓰면 UPDATE가 되므로 0009에 없던
-- update 정책을 추가한다. (경로에 Date.now()+random이 붙어 충돌은 거의 없지만,
--  없으면 실패 원인을 찾기 어려운 유형이라 미리 열어둔다)
do $$ begin
  create policy "campaign_images_update" on storage.objects
    for update to authenticated using (bucket_id = 'campaign-images');
exception when duplicate_object then null; end $$;
