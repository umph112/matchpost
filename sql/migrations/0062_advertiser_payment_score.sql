-- 0062  정산 성실도(광고주 신뢰 지표) — SPEC-B-SETTLE.md "정산 성실도" 절
--
-- 인플루언서가 확정 전에 "이 광고주가 제때 정산하는가"를 볼 수 있게 하는 집계.
-- 캐시 테이블이 아니라 뷰로 만든다 — settleCampaign 훅마다 별도로 갱신할 필요가 없고,
-- 이 프로젝트 규모에서 라이브 집계 비용이 문제될 정도로 크지 않다(0041 trust_score는
-- 전체 재계산이라 배치로 캐시했지만, 이건 advertiser_id로 이미 좁혀지는 집계라 다르다).
--
-- 인플루언서 귀책 제외는 문서 요구사항이지만 "귀책 판정"을 위한 필드가 스키마에 없다
-- (딜시트 단계 타임스탬프만으로는 원고 지연/수정요청 미응답을 지연 사유로 자동 구분할 수 없음).
-- 여기서는 실제로 계산 가능한 근사치로 둔다: draft/publish 체크포인트가 지연 없이(late_days=0)
-- 끝난 건만 "광고주 귀책 지연" 판정 대상으로 삼는다. 더 정밀한 판정이 필요해지면 별도 결정 필요.

begin;

create or replace view advertiser_payment_score as
with settled as (
  select
    p.advertiser_id,
    p.settled_at,
    -- payment_due_date_original(사후 변경 전 원래 값)이 있으면 그걸 기준으로 한다(문서 요구사항)
    greatest(0, (date(p.settled_at) - coalesce(p.payment_due_date_original, p.payment_due_date))) as late_days,
    -- 콘텐츠 단계(draft/publish)가 지연 없이 끝났을 때만 "광고주 귀책" 판정 대상
    not exists (
      select 1 from deal_checkpoints dc
      where dc.proposal_id = p.id and dc.kind in ('draft', 'publish') and coalesce(dc.late_days, 0) > 0
    ) as advertiser_attributable
  from proposals p
  where p.settled_at is not null
    and p.settled_at >= now() - interval '12 months'
    and coalesce(p.payment_due_date_original, p.payment_due_date) is not null
)
select
  advertiser_id,
  12 as window_months,
  count(*) filter (where advertiser_attributable) as deals_count,
  count(*) filter (where advertiser_attributable and late_days <= 3) as on_time_count,
  count(*) filter (where advertiser_attributable and late_days > 3) as late_count,
  avg(late_days) filter (where advertiser_attributable and late_days > 3) as avg_late_days,
  case
    when count(*) filter (where advertiser_attributable) >= 3
      then round(
        100.0 * count(*) filter (where advertiser_attributable and late_days <= 3)
        / nullif(count(*) filter (where advertiser_attributable), 0), 1
      )
    else null
  end as on_time_rate,
  now() as updated_at
from settled
group by advertiser_id;

commit;
