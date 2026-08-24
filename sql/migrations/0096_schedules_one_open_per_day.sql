-- 0096  한 사람이 같은 날에 오픈을 두 번 열 수 없게 한다
--
-- 왜 필요한가.
--   등록 폼(influencer/schedule)은 그냥 insert 만 했고 DB에도 막는 게 없었다.
--   실제로 같은 사람이 2026-09-07 을 3분 간격으로 두 번 열어 두 줄이 남아 있었다.
--   광고주 「인플루언서 찾기」는 오픈 한 줄에 카드 하나를 그리므로,
--   같은 사람이 같은 날짜에 두 번 보인다. 어느 쪽에 말을 걸어야 하는지 알 수 없다.
--
--   화면에서만 막으면 창 두 개나 빠른 두 번 클릭으로 뚫린다(위 두 줄이 그 모양이다).
--   그래서 DB에도 못을 박는다. 화면 안내는 폼에서 따로 한다.
--
-- ⚠️ 기간 오픈(date ~ date_end)이 겹치는 경우는 여기서 다루지 않는다.
--    date_end 는 읽는 곳은 넷인데 쓰는 곳이 없어서(등록 폼에 종료일 입력이 없다)
--    기간 오픈은 아직 만들 수조차 없다. 겹침 제약은 종료일 입력이 생긴 뒤에 붙인다.

-- 1) 인덱스를 걸기 전에 이미 있는 중복을 정리한다.
--    가장 먼저 만든 줄을 남기고, 늦게 만든 줄 중 「아무것도 안 붙은 것」만 지운다.
--    제안이 붙은 줄은 지우지 않는다 — 지우면 그 협업이 통째로 사라진다.
--    (대화 conversations 는 schedule_id 를 갖지 않는다. 오픈에 직접 매달린 건 제안뿐이다.)
--    그런 줄이 남아 있으면 아래 인덱스 생성이 실패한다. 실패하는 게 맞다.
--    사람이 어느 쪽을 남길지 정해야 하는 상황이지 자동으로 고를 일이 아니다.
with ranked as (
  select id, influencer_id, date,
         row_number() over (partition by influencer_id, date order by created_at) as rn
    from schedules
)
delete from schedules s
 using ranked r
 where s.id = r.id
   and r.rn > 1
   and not exists (select 1 from proposals p where p.schedule_id = s.id);

-- 2) 한 사람 · 하루 · 오픈 하나.
create unique index if not exists schedules_one_open_per_day
  on schedules (influencer_id, date);
