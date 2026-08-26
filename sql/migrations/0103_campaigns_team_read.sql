-- 0103  캠페인 — 팀원 읽기 정책
--
-- campaigns 에는 정책이 둘뿐이었다(pg_policies 확인):
--   advertiser manages own   ALL     auth.uid() = advertiser_id
--   public read open campaigns SELECT is_public = true and status = 'open'
-- 그래서 팀원은 회사 캠페인이 비공개이거나 모집이 끝나면 아예 읽지 못했다.
-- D14 팀 화면이 「목록은 비었는데 상세는 열리는」 상태가 된 원인이다.
--
-- SELECT 만 준다 — 쓰기는 대표(advertiser manages own)에 그대로 둔다.
-- manager_id 는 정책에 넣지 않는다. 「내 담당」은 화면의 기본 필터이지 권한 경계가 아니다
-- (campaigns/page.tsx:35 에서 scopeToMe 일 때만 manager_id 로 좁힌다).
--
-- status 범위는 0095:45-63 의 advertiser_profiles 정책을 그대로 따랐다 —
-- 'inactive'(퇴사 완료)는 빼고, 'leaving'(퇴사 예정, 0085)은 아직 일하는 중이라 포함한다.
--
-- 확인(2026-08-26): 팀원 회사 캠페인 1건(내 담당 1건) / 팀원이 보는 남의 회사 0건 /
-- 대표 1건(무회귀) / 다른 회사 팀원 0건.

begin;

drop policy if exists "team reads company campaigns" on campaigns;
create policy "team reads company campaigns"
  on campaigns
  for select
  to authenticated
  using (
    exists (
      select 1
      from team_members tm
      where tm.owner_id  = campaigns.advertiser_id
        and tm.member_id = auth.uid()
        and tm.status in ('active', 'leaving')
    )
  );

commit;
