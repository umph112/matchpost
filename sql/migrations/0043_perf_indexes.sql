-- 0043  조회 패턴 기준 인덱스
-- 이 프로젝트엔 org_id 개념이 없어(개별 광고주/인플루언서 유저 단위) 실제 쓰이는 조합으로 대체.

begin;

create index if not exists proposals_campaign_stage_idx on proposals(campaign_id, stage);
create index if not exists schedules_influencer_date_idx on schedules(influencer_id, date);
create index if not exists notifications_user_state_idx on notifications(user_id, state);

commit;
