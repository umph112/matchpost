-- 0017  블로그 포스팅 단위 키워드 노출 + 종합 등급
alter table blog_analytics
  add column if not exists post_keyword_rankings jsonb,  -- [{log_no, title, found, rank}, ...]
  add column if not exists blog_grade            text;   -- S / A / B / C / D
