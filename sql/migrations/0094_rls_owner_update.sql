-- 0094  본인 프로필 UPDATE 를 RLS 로 허용 (influencer_profiles · advertiser_profiles)
--
-- ■ 사고 내용
-- 두 테이블에 UPDATE 정책이 하나도 없었다. RLS 가 켜져 있고(relrowsecurity = true)
-- 허용 정책이 없으면 UPDATE 는 「거부」가 아니라 「대상 0행」이 된다 —
-- PostgREST 는 error: null, data: [] 를 돌려주고, 앱 코드의 `if (error)` 는 이걸
-- 성공으로 읽는다. 그래서 화면엔 「저장됐어요!」가 뜨는 동안 DB 에는 아무것도 안 들어갔다.
--
-- 실제 피해:
--   · /influencer/profile — 소개·플랫폼·분야·팔로워·채널 주소가 통째로 저장되지 않았다.
--   · /advertiser/team    — 0082 로 만든 intro·one_line·brands·history·marketing_phone
--                           이 4개 계정 전부 비어 있었다. 값이 비면 회사 페이지가 그 카드를
--                           아예 렌더하지 않아서, 「기능이 없는 것」처럼 보였다.
--
-- ■ 왜 레포에 없었나
-- 이 프로젝트의 RLS 는 지금까지 Supabase 대시보드에서만 만들어졌다. 레포에 정책이
-- 없으니 리뷰도 diff 도 불가능했고, 빠진 정책이 있어도 아무도 알 수 없었다.
-- 이 파일부터 정책은 레포에서 관리한다.
--
-- ■ 범위
-- 여기서는 「없어서 저장이 죽던 UPDATE」만 더한다. 기존 SELECT/INSERT 정책은 읽지도
-- 고치지도 않는다 — 지금 동작하는 것을 바꾸지 않기 위해서다.
-- (profiles · user_private · team_members 는 실측 결과 owner UPDATE 가 이미 통과한다.)
--
-- ■ 앱 쪽 짝
-- 정책만으로는 재발을 못 막는다. 저장하는 화면은 .update(...).select() 로 돌아온
-- 행 수를 세고, 0행이면 「저장됐어요!」 대신 실패를 띄운다.
--   src/app/(dashboard)/influencer/profile/page.tsx
--   src/app/(dashboard)/advertiser/team/page.tsx

begin;

-- influencer_profiles ---------------------------------------------------------
-- 본인 행만. with check 를 같이 걸어 user_id 를 남의 것으로 바꿔치기하는 UPDATE 를 막는다
-- (using 만 걸면 「내 행을 남의 행으로 만들기」가 통과한다).
drop policy if exists "own influencer profile update" on influencer_profiles;
create policy "own influencer profile update"
  on influencer_profiles
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- advertiser_profiles ---------------------------------------------------------
-- 팀원이 회사 프로필을 고치는 건 아직 대표만 하도록 둔다(현재 화면도 대표 기준이다).
-- 팀원 편집을 열려면 team_members 를 참조하는 별도 정책으로 다음 차수에 더한다.
drop policy if exists "own advertiser profile update" on advertiser_profiles;
create policy "own advertiser profile update"
  on advertiser_profiles
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

commit;
