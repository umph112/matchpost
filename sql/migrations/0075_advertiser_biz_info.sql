-- 0075  광고주 사업자 정보 + 서류 저장 경로 — D7 5-1/5-2
--
-- 가입 폼이 상호/사업자등록번호/서류를 받지 않아 advertiser_profiles.company_name이 항상 비어있던
-- 문제(advertiser/layout.tsx가 이 값을 읽어 콘솔 상단에 표시함)와, 관리자 승인 심사가 실제로는
-- 확인할 서류가 없었던 문제를 함께 해결한다.
--
-- 서류(biz_doc_url)는 사설 버킷(biz-docs, public=false)에 저장하고, 승인/반려 즉시 또는
-- 업로드 30일 후 자동으로 원본을 지운다(개인정보처리방침 4절 ⑤·이용약관 제17조 ⑤에 이미 공개한 내용).
-- 확인 결과(사업자등록번호)는 삭제 후에도 advertiser_profiles.biz_reg_number에 남는다.

begin;

alter table advertiser_profiles
  add column if not exists biz_reg_number     text,
  add column if not exists address            text,
  add column if not exists biz_doc_url        text,
  add column if not exists biz_doc_uploaded_at timestamptz;

insert into storage.buckets (id, name, public)
values ('biz-docs', 'biz-docs', false)
on conflict (id) do nothing;

commit;
