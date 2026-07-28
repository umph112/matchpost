-- 캠페인 이미지 (최대 5장 + 대표사진)
alter table campaigns
  add column if not exists image_urls  text[]  default '{}',
  add column if not exists cover_image_url text  default null;
