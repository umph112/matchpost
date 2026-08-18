-- 0081_campaigns_brand.sql
-- 캠페인에 노출용 브랜드명 추가. 인플루언서 화면에는 이 값을 그대로 보여준다.
-- 비면 광고주 회사 상호(advertiser_profiles.company_name)를 대신 쓴다.
alter table campaigns add column if not exists brand_name text;
comment on column campaigns.brand_name is
  '광고 대상 브랜드. 대행이면 클라이언트 브랜드명, 직접이면 자기 상호. 비면 회사 상호를 쓴다.';
