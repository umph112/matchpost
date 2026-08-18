-- 0082_advertiser_public_profile.sql
-- 광고주 공개 프로필(/advertiser/[id])의 「직접 작성」 항목과 마케팅 문의 공개 설정.
-- 「매치포스트 기록」(정산·협업·활동기간·평가)은 기존 집계(advertiser_payment_score·reviews·
-- proposals·profiles.created_at)로 그리므로 컬럼이 필요 없다. 여기 컬럼은 전부 광고주가
-- 직접 채우는 값이며, 편집 화면은 다음 차수에서 붙인다(그전까지는 비어 있어 화면에서 숨는다).
--
-- 마케팅 문의는 기본 비공개다. 켠 계정(대행 문의를 받을 곳)만 이메일/전화가 공개된다.
-- 삼성전자 계정에 마케팅 문의가 오면 안 된다.

alter table advertiser_profiles
  add column if not exists intro                    text,   -- 소개 (한 줄 소개의 기본 출처)
  add column if not exists one_line                 text,   -- 상단 한 줄 소개 (비면 intro 첫 문장)
  add column if not exists brands                   text,   -- 함께 일하는 브랜드
  add column if not exists history                  text,   -- 주요 이력
  add column if not exists marketing_contact_public boolean not null default false,
  add column if not exists marketing_email          text,
  add column if not exists marketing_phone          text;

comment on column advertiser_profiles.marketing_contact_public is
  '마케팅(대행) 문의 공개 여부. 기본 false. 켠 계정만 이메일/전화를 공개 프로필에 노출한다.';
