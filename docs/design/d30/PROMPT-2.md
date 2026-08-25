# VS Code 프롬프트 2 (D30 [1]) — 별도 테이블로

아래 블록을 그대로 복사해 붙여넣으세요.

---

```
정확한 지적이야. 내 문서가 틀렸어 — ignoreDuplicates 를 못 보고 컬럼만 붙이라고 했어.
「그날 첫 방문 시각」은 「저녁에 사람이 많은가」와 다른 지표야.

[답] user_visit_log 를 건드리지 마. 새 테이블을 만들어줘.

  그 테이블은 「하루 순방문자」의 원본이고 리워드 판정(주 5일 · 월 20일)이 그 위에 서 있어.
  거기에 시각을 얹으면 두 지표가 한 행에서 싸워. 성격이 다른 걸 합치면 어느 쪽이
  사실인지 알 수 없게 돼 — 이번 세션에 여러 번 본 그 문제야.

  sql/migrations/0097_page_views.sql

    create table if not exists page_views (
      id         bigserial primary key,
      user_id    uuid references profiles(id) on delete set null,
      path       text,
      viewed_at  timestamptz not null default now()
    );
    create index on page_views (viewed_at desc);

  · 매 방문마다 한 행. upsert 아니고 insert
  · user_id 는 null 허용 — 로그아웃 방문(공개 페이지)도 세야 해
  · path 를 남겨 「어느 화면이 많이 열리나」도 볼 수 있게

  ⚠️ 보관 기간을 정해줘 — 매 방문마다 쌓이니 커져.
     90일 넘은 행은 지우는 배치를 하나 붙여줘 (purge-attachments 와 같은 방식).
     그 전에 시간대별로 집계해서 남기고 원본만 버리는 게 맞아 —
     3개월 전 저녁 트래픽도 비교선으로 필요하니까.
     집계 테이블 모양은 네가 판단해서 제안해줘.

  · recordVisit 은 그대로 두고, page_views insert 를 나란히 추가
  · RLS — 본인만 SELECT 하는 건 의미가 없어. 관리자만 읽게 하고
    쓰기는 service 로. 방문 기록은 본인이 볼 것이 아니야

[화면]
  관리자 「오늘」 트래픽에 시간대 탭. 일별 탭은 그대로 두고 둘 다.
  시간대 탭은 page_views 를 읽고, 일별 탭은 지금처럼 user_visit_log 를 읽어.
  page_views 가 쌓이기 전 구간은 「이 날짜 이전은 시간 정보가 없어요」로 비워.

⚠️ 리워드 판정 로직은 한 줄도 건드리지 마. visited_on 도 그대로.
```
