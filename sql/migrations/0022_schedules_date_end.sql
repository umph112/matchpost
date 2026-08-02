-- 0022  schedules.date_end — 기간 오픈 지원
-- 단일 날짜(date)만 있던 schedules에 종료일(date_end) 추가.
-- date_end가 null이면 date 단일 날짜, 값이 있으면 date~date_end 기간.
-- deal/confirm 진행일 체크에서 date OR date_end 중 하나라도 있으면 확정 가능.

alter table schedules
  add column if not exists date_end date;
