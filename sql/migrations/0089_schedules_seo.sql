-- 0089  schedules.seo_public — 검색엔진 노출 opt-in
-- 오픈(인플루언서 일정)을 네이버·구글에 노출할지 여부. 기본 OFF.
-- is_public(광고주에게 공개)과 별개의 명시적 동의값이다.
-- seo_public=true 인 오픈만 /opens/[id] 공개 페이지와 sitemap 에 실린다.
-- 이름·연락처·채널 주소는 공개 페이지에서도 노출하지 않는다(로그인한 사람에게만).
alter table schedules
  add column if not exists seo_public boolean not null default false;
