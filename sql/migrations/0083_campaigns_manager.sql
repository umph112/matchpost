-- 0083  campaigns.manager_id — 캠페인의 담당 팀원 (D14 1절)
--
-- 2~5절 전부가 이 컬럼에 걸려 있다. sql/migrations/ 전체를 검색해 campaigns 에 manager_id 가
-- 없음을 확인했다(0건). manager_id 는 지금 conversations(0065)에만 있고 그건 「대화 담당」으로 별개다.
-- ⚠️ 기존 마이그레이션은 수정하지 않는다 — 여기서 컬럼만 추가한다.

begin;

alter table campaigns add column if not exists manager_id uuid references profiles(id);
comment on column campaigns.manager_id is
  '이 캠페인의 담당 팀원. 대표가 만들면 대표 id. 이관·대행의 단위가 된다.';

-- 기존 행은 회사 대표(advertiser_id)를 담당으로 본다
update campaigns set manager_id = advertiser_id where manager_id is null;

create index if not exists campaigns_manager_idx on campaigns (manager_id);

commit;
