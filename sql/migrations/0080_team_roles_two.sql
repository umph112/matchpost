-- 0080  팀 역할을 「대표 · 팀원」 둘로 — D13 1장
--
-- 0063에서 role은 '담당자'/'관리자' 두 값이었다. D13에서 역할 체계를 「대표(사업자 정보·팀 초대·결제)
-- / 팀원(캠페인 등록·딜시트·정산 기록)」 둘로 통합한다. team_members에 담기는 초대 대상은 전부 '팀원'
-- 이고, '대표'는 소유자 본인(team_members에 행이 없음)이라 여기 role 값으로는 '팀원'만 허용한다.
-- ⚠️ 0063은 이미 적용됐으므로 수정하지 않는다 — 여기서 제약/기본값만 갈아끼운다.

begin;

alter table team_members drop constraint if exists team_members_role_check;
update team_members set role = '팀원' where role in ('담당자', '관리자');
alter table team_members alter column role set default '팀원';
alter table team_members add constraint team_members_role_check
  check (role in ('팀원'));

commit;
