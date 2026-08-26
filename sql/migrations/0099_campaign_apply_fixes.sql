-- 0099  캠페인 지원 — 뒷단 구멍 두 개 (D32 1절 보강)
--
-- 0098 로 지원 경로를 냈더니, 검증할 캠페인을 만드는 단계에서 두 가지가 걸렸다.
--   A. 제품·기자단 캠페인은 등록 자체가 안 된다 (campaigns.date 가 NOT NULL)
--   B. 지원한 사람에게 「새 대시가 도착했습니다」가 간다 (레포에 없는 트리거)

begin;

-- ── A. campaigns.date 를 nullable 로 ────────────────────────────────
-- 진행일(방문일)은 지역 캠페인만 있다. 등록 폼도 비지역이면 여기에 null 을 넣는다
-- (advertiser/campaigns/new/page.tsx — `date: sorted[0]?.date ?? null`).
-- 폼이 맞고 제약이 틀렸다. 이 NOT NULL 때문에 제품·기자단은 저장 버튼을 눌러도
-- 「캠페인 등록에 실패했어요」만 떴다 — 등록이 한 건도 안 됐다.
--
-- ⚠️ 읽는 쪽은 이미 null 을 견딘다. 검색 카드는 dateWithDow(null) → 빈 문자열이고,
--    지원 함수(0098)는 지역이 아니면 date 를 아예 안 본다.
alter table campaigns alter column date drop not null;

comment on column campaigns.date is
  '방문일(지역 캠페인의 첫 날짜). 제품·기자단은 방문이 없어 null 이다. 여러 날은 dates[] 에 있고 이 컬럼은 달력 매칭용 하위호환.';

-- ── B. 지원자에게 가던 「새 대시가 도착했습니다」 트리거 제거 ────────
-- proposals 에 줄이 생기면 무조건 influencer_id 에게 대시 알림을 넣는 트리거가
-- DB 에 직접 만들어져 있다(레포·마이그레이션 어디에도 없다 — RLS 정책 때와 같은 문제).
-- 광고주가 거는 대시는 send_dash() 가 이미 자기 손으로 알림을 넣으므로 이 트리거는
-- 그때도 알림을 두 번 만들고, 인플루언서가 지원할 때는 방향이 아예 반대가 된다
-- (지원한 본인에게 「광고주가 협업을 제안했어요」가 간다).
--
-- 이름을 못 박지 않고 찾아서 지운다 — 만든 사람이 없어 이름을 신뢰할 수 없다.
-- 지우는 조건은 「트리거 함수 본문에 그 문구가 그대로 들어 있는 것」 하나뿐이다.
-- 함수 자체는 남긴다(다른 데서 부를 수도 있어 눈으로 보고 지운다).
do $$
declare
  r record;
  v_def text;
begin
  for r in
    select t.tgname, c.relname, p.oid as fnoid, p.proname
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_proc  p on p.oid = t.tgfoid
    where not t.tgisinternal
      and c.relnamespace = 'public'::regnamespace
      and c.relname in ('proposals', 'campaigns')
  loop
    v_def := pg_get_functiondef(r.fnoid);
    if v_def like '%새 대시가 도착했습니다%' then
      execute format('drop trigger if exists %I on public.%I', r.tgname, r.relname);
      raise notice '[0099] 지움  %.% → %()', r.relname, r.tgname, r.proname;
    else
      raise notice '[0099] 남김  %.% → %()', r.relname, r.tgname, r.proname;
    end if;
  end loop;
end $$;

commit;

-- ── 남은 트리거 목록 ────────────────────────────────────────────────
-- 실행하면 이 표가 결과창에 뜬다. 그대로 복사해서 알려주세요 —
-- campaign_created(「캠페인이 등록되었습니다」)를 비롯해 레포에 없는 것이 더 있는지
-- 이 표로 확인하고, 남길 것과 지울 것을 다음 마이그레이션에 이름으로 적어 둔다.
select
  c.relname                                    as "테이블",
  t.tgname                                     as "트리거",
  p.proname                                    as "함수",
  case when pg_get_functiondef(p.oid) like '%notifications%' then '알림 넣음' else '' end as "비고"
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_proc  p on p.oid = t.tgfoid
where not t.tgisinternal
  and c.relnamespace = 'public'::regnamespace
  and c.relname in ('proposals', 'campaigns', 'messages')
order by c.relname, t.tgname;
