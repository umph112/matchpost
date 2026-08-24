-- 0095  advertiser_profiles 읽기 — 본인·팀원은 RLS 로, 남에게는 안전한 컬럼만 뷰로
--
-- 0094 에서 고친 UPDATE 와 똑같은 사고가 SELECT 쪽에도 있었다.
-- advertiser_profiles 에는 SELECT 정책이 하나도 없었다. RLS 가 켜진 테이블에 정책이 없으면
-- 조회는 에러가 아니라 「0행 + error=null」로 돌아온다. 그래서 화면은 아무 말 없이 빈 값을 그렸다.
--
--   실측(봇 계정, 세션 클라이언트):
--     광고주가 본인 advertiser_profiles 읽기  → 0행  error=null
--     인플루언서가 광고주 회사정보 읽기        → 0행  error=null
--
--   그동안 조용히 비어 있던 자리:
--     advertiser/layout.tsx           콘솔 상단 회사명 — 광고주가 로그인할 때마다 보는 자리
--     advertiser/team                 공개 프로필 편집 카드(본인 행)
--     advertiser/messages/[id]        대화 상단 회사명
--     day/[date] · influencer/schedule/[id] · influencer/proposals ·
--     influencer/earnings(3곳) · influencer/search     광고주 회사명 → 담당자 이름으로 폴백돼 있었음
--   (advertiser/[id] 공개 페이지 · campaigns/[id] · sitemap · admin 큐는 service_role 로 읽어
--    영향이 없었다. 여기서 고치는 건 「로그인한 사용자 세션으로 읽는 곳」뿐이다.)
--
-- ── 왜 그냥 `using (true)` 로 열지 않는가 ────────────────────────────────────
-- 같은 테이블에 biz_reg_number(사업자등록번호) · business_number · address ·
-- biz_doc_url(사업자등록증 사설버킷 경로)이 함께 들어 있다. RLS 는 행 단위라 컬럼을 못 가린다.
-- SELECT 를 true 로 열면 로그인한 누구나 전 광고주의 사업자등록번호와 서류 경로를 읽는다.
-- 게다가 marketing_email/marketing_phone 은 marketing_contact_public 토글로 공개를 제어하는데,
-- 테이블을 통째로 열면 그 토글이 무의미해진다(0082 에서 「삼성전자 계정에 마케팅 문의가 오면
-- 안 된다」고 적어둔 그 설정).
--
-- 그래서 user_private 을 분리했던 것과 같은 방식으로 두 겹으로 나눈다.
--   ① 본인 + 활동 중인 팀원  → RLS 정책. 전체 컬럼(편집 화면이 필요로 함).
--   ② 그 외 로그인 사용자    → advertiser_public 뷰. 회사가 스스로 공개하려고 적은 값만.
--
-- 뷰는 security_invoker = false(기본값) — 뷰 소유자 권한으로 실행돼 기반 테이블 RLS 를 지나간다.
-- 안전장치는 정책이 아니라 뷰의 컬럼 목록 그 자체다. 여기 없는 컬럼은 어떤 방법으로도 안 나간다.

begin;

-- ① 본인 --------------------------------------------------------------------
drop policy if exists "own advertiser profile read" on advertiser_profiles;
create policy "own advertiser profile read"
  on advertiser_profiles
  for select
  to authenticated
  using (auth.uid() = user_id);

-- ① 팀원 --------------------------------------------------------------------
-- 팀원(0063)은 대표 계정의 캠페인·딜시트를 다루므로 회사 정보를 봐야 한다.
-- 'inactive'(퇴사 완료)는 뺀다. 'leaving'(퇴사 예정, 0085)은 아직 일하는 중이라 포함한다.
-- team_members 자신의 RLS("member reads own membership": member_id = auth.uid())가
-- 이 서브쿼리에도 걸리므로, 남의 팀 관계를 캐내는 데는 쓸 수 없다.
drop policy if exists "team member reads advertiser profile" on advertiser_profiles;
create policy "team member reads advertiser profile"
  on advertiser_profiles
  for select
  to authenticated
  using (
    exists (
      select 1
      from team_members tm
      where tm.owner_id = advertiser_profiles.user_id
        and tm.member_id = auth.uid()
        and tm.status in ('active', 'leaving')
    )
  );

-- ① 관리자 ------------------------------------------------------------------
-- /admin/users 의 회원 목록은 사업자등록번호·상호를 세션 클라이언트로 읽는다(뷰에는 없는 값).
-- 정책이 없어 이 칸도 계속 비어 있었다. 조건은 profiles 의 기존 「관리자 프로필 수정」 정책과
-- 같은 모양을 그대로 쓴다 — 새 판정 기준을 만들지 않는다.
drop policy if exists "admin reads advertiser profiles" on advertiser_profiles;
create policy "admin reads advertiser profiles"
  on advertiser_profiles
  for select
  to authenticated
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- ② 공개 뷰 ------------------------------------------------------------------
-- 회사가 직접 적어 넣은 소개성 값만. 사업자등록번호·주소·서류 경로는 여기 없다.
-- 마케팅 연락처는 marketing_contact_public 이 켜진 계정만 값이 나가고, 꺼져 있으면 null 이다.
drop view if exists advertiser_public;
create view advertiser_public as
select
  ap.user_id,
  ap.company_name,
  ap.business_type,
  ap.description,
  ap.website_url,
  ap.one_line,
  ap.intro,
  ap.brands,
  ap.history,
  ap.marketing_contact_public,
  case when ap.marketing_contact_public then ap.marketing_email end as marketing_email,
  case when ap.marketing_contact_public then ap.marketing_phone end as marketing_phone
from advertiser_profiles ap;

comment on view advertiser_public is
  'advertiser_profiles 중 공개해도 되는 컬럼만. 사업자등록번호·주소·서류 경로는 제외한다. '
  '로그인 사용자가 남의 회사명을 읽는 곳은 전부 이 뷰를 쓴다(0095).';

grant select on advertiser_public to anon, authenticated;

commit;
