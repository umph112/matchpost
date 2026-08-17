-- 0078  사업자등록번호 중복 가입 방지 — PROMPT-8
--
-- advertiser_profiles.biz_reg_number(0075에서 이미 추가됨)에 유니크 제약을 건다.
-- 같은 사업자번호로 계정이 여러 개 생기면 정산·크레딧·평가가 흩어져 나중에 합칠 방법이 없다.
-- (문서의 business_number 는 실제로는 biz_reg_number — 기존 컬럼을 쓴다. 새 컬럼 만들지 않음.)
--
-- ⚠️ 먼저 기존 값을 숫자만 남기도록 정규화한다('123-45-67890' → '1234567890').
--    정규화 후 중복이 남아 있으면 유니크 인덱스 생성이 실패한다 — 그 경우 중복 행을 먼저
--    정리해야 한다(개발 데이터라면 대개 없음).

begin;

-- 기존 값 정규화: 하이픈 등 비숫자 제거
update advertiser_profiles
  set biz_reg_number = regexp_replace(biz_reg_number, '\D', '', 'g')
  where biz_reg_number is not null
    and biz_reg_number <> regexp_replace(biz_reg_number, '\D', '', 'g');

-- 정규화된 값 기준 유니크 (null·빈문자는 제외)
create unique index if not exists advertiser_profiles_biz_reg_number_key
  on advertiser_profiles (biz_reg_number)
  where biz_reg_number is not null and biz_reg_number <> '';

commit;
