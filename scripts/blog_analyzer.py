"""
MatchPost 블로그 분석기 — 네이버 블로그
Supabase influencer_profiles.blog_url 을 읽어 자동 수집 → blog_analytics 테이블에 저장

실행:
  python scripts/blog_analyzer.py              # 전체 실행
  python scripts/blog_analyzer.py --user-id <uuid>   # 특정 유저만
  python scripts/blog_analyzer.py --no-keywords      # 키워드 체크 생략
"""

import os
import re
import time
import random
import argparse
import json as _json
from datetime import datetime, date, timedelta, timezone
from urllib.parse import urlparse, unquote_plus

import requests
from bs4 import BeautifulSoup
from supabase import create_client
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env.local'))

SUPABASE_URL        = os.environ['NEXT_PUBLIC_SUPABASE_URL']
SUPABASE_KEY        = os.environ['SUPABASE_SERVICE_ROLE_KEY']
NAVER_CLIENT_ID     = os.environ.get('NAVER_API_CLIENT_ID', '')
NAVER_CLIENT_SECRET = os.environ.get('NAVER_API_CLIENT_SECRET', '')

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

PC_HEADERS = {
    'User-Agent': (
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
        'AppleWebKit/537.36 (KHTML, like Gecko) '
        'Chrome/124.0.0.0 Safari/537.36'
    ),
    'Accept-Language': 'ko-KR,ko;q=0.9',
    'Referer': 'https://www.naver.com/',
}
MOBILE_HEADERS = {
    **PC_HEADERS,
    'User-Agent': (
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) '
        'AppleWebKit/605.1.15 (KHTML, like Gecko) '
        'Version/17.0 Mobile/15E148 Safari/604.1'
    ),
}

# 카테고리별 보조 키워드 (포스팅 노출 체크가 메인, 이건 보완용 — 3개로 축소)
CATEGORY_KEYWORDS: dict[str, list[str]] = {
    '스타일':              ['스타일링 추천', '코디 추천', '데일리룩'],
    '패션':               ['패션 추천', '옷 코디', '브랜드 추천'],
    '뷰티':               ['뷰티 리뷰', '화장품 추천', '스킨케어 추천'],
    '라이프':             ['라이프스타일', '생활 꿀팁', '일상 공유'],
    '리빙':               ['인테리어 추천', '집꾸미기', '홈데코'],
    '육아':               ['육아 일기', '아기 용품 추천', '육아 꿀팁'],
    '생활건강':           ['건강 관리', '영양제 추천', '다이어트 식단'],
    '푸드':               ['맛집 추천', '레시피', '맛집 탐방'],
    '여행':               ['국내여행', '해외여행 추천', '여행 후기'],
    '동물/펫':            ['반려동물 용품', '강아지 추천', '고양이 추천'],
    '스포츠/운동/레저':   ['운동 루틴', '헬스 추천', '홈트 추천'],
    '프로스포츠':         ['프로야구 분석', '축구 분석', '스포츠 뉴스'],
    '게임':               ['게임 리뷰', '게임 공략', '모바일 게임 추천'],
    '테크/IT':            ['IT 제품 리뷰', '스마트폰 리뷰', '노트북 추천'],
    '자동차':             ['자동차 리뷰', '신차 시승기', '전기차 추천'],
    '방송/연예':          ['드라마 추천', '연예 뉴스', '예능 추천'],
    '대중음악':           ['음악 추천', '앨범 리뷰', '신곡 추천'],
    '컬처':               ['전시회 추천', '공연 후기', '문화생활'],
    '영화/공연/전시/예술': ['영화 리뷰', '공연 추천', '전시회 후기'],
    '도서':               ['책 추천', '독서 후기', '베스트셀러'],
    '경제/비즈니스':      ['재테크', '주식 추천', '경제 뉴스'],
    '어학/교육':          ['영어 공부법', '자격증 공부', '공부 꿀팁'],
    '기타':               ['솔직 후기', '생활 정보', '사용 후기'],
}
DEFAULT_KEYWORDS = ['솔직 후기', '생활 정보', '사용 후기']


# ── URL 파싱 ────────────────────────────────────────────────────────────────

def extract_blog_id(url: str) -> str | None:
    url = url.strip()
    if not url:
        return None
    if not url.startswith('http'):
        url = 'https://' + url
    parsed = urlparse(url)
    if 'blog.naver.com' not in parsed.netloc:
        return None
    path = parsed.path.strip('/')
    if not path:
        return None
    blog_id = path.split('/')[0]
    return blog_id or None


# ── 크롤링 ─────────────────────────────────────────────────────────────────

def _get(url: str, mobile: bool = False) -> requests.Response | None:
    headers = MOBILE_HEADERS if mobile else PC_HEADERS
    try:
        r = requests.get(url, headers=headers, timeout=12)
        if r.status_code == 200:
            return r
    except Exception:
        pass
    return None


def _parse_naver_date(s: str) -> date | None:
    s = s.strip()
    m = re.match(r'(\d+)\s*일\s*전', s)
    if m:
        return (datetime.now() - timedelta(days=int(m.group(1)))).date()
    m = re.match(r'(\d+)\s*시간\s*전', s)
    if m:
        return datetime.now().date()
    if '분' in s or '방금' in s:
        return datetime.now().date()
    m = re.match(r'(\d{4})\.(\d{1,2})\.(\d{1,2})', s)
    if m:
        try:
            return date(int(m.group(1)), int(m.group(2)), int(m.group(3)))
        except ValueError:
            pass
    return None


def fetch_blog_analytics(blog_id: str) -> tuple[dict, list]:
    """블로그 기본 지표 수집. 반환: (analytics_dict, posts_list)"""
    result: dict = {
        'blog_id':        blog_id,
        'neighbor_count': None,
        'visitor_today':  None,
        'visitor_total':  None,
        'post_count':     None,
        'avg_likes':      None,
        'avg_comments':   None,
        'last_post_date': None,
        'post_frequency': None,
        'error_message':  None,
    }
    posts: list = []

    # ── 1. 모바일 메인 페이지 ─────────────────────────────────────────────
    r = _get(f'https://m.blog.naver.com/{blog_id}', mobile=True)
    if not r:
        result['error_message'] = '블로그 페이지 접근 실패'
        return result, posts

    soup = BeautifulSoup(r.text, 'html.parser')
    text = soup.get_text()

    m = re.search(r'([\d,]+)\s*명의\s*이웃', text)
    if m:
        result['neighbor_count'] = int(m.group(1).replace(',', ''))

    m2 = re.search(r'오늘\s*([\d,]+)\s*전체\s*([\d,]+)', text)
    if m2:
        result['visitor_today'] = int(m2.group(1).replace(',', ''))
        result['visitor_total'] = int(m2.group(2).replace(',', ''))

    # ── 2. 포스트 목록 API ────────────────────────────────────────────────
    r2 = _get(
        f'https://blog.naver.com/PostTitleListAsync.naver'
        f'?blogId={blog_id}&viewdate=&currentPage=1&categoryNo=&countPerPage=10&orderby=desc'
    )
    if r2:
        try:
            raw = r2.text
            try:
                data = _json.loads(raw)
            except _json.JSONDecodeError:
                raw_fixed = re.sub(r'\\(?!["\\/bfnrtu])', r'\\\\', raw)
                data = _json.loads(raw_fixed)

            posts = data.get('postList', [])
            result['post_count'] = data.get('totalCount')

            if posts:
                latest_date = _parse_naver_date(posts[0].get('addDate', ''))
                if latest_date:
                    result['last_post_date'] = latest_date.isoformat()

                comment_counts = [
                    int(p.get('commentCount', 0))
                    for p in posts if str(p.get('commentCount', '')).isdigit()
                ]
                if comment_counts:
                    result['avg_comments'] = round(sum(comment_counts) / len(comment_counts), 1)

                dated = [_parse_naver_date(p.get('addDate', '')) for p in posts]
                dated = [d for d in dated if d]
                if len(dated) >= 2:
                    span_days = (dated[0] - dated[-1]).days or 1
                    result['post_frequency'] = round(len(dated) / max(span_days, 1) * 30, 1)

        except Exception as e:
            result['error_message'] = f'포스트 목록 파싱 오류: {e}'

    return result, posts


# ── 네이버 블로그 검색 API 공통 호출 ────────────────────────────────────────

def _naver_blog_search(query: str, display: int = 100) -> list | None:
    """네이버 블로그 검색 API 호출. 실패/한도 초과 시 None 반환."""
    if not NAVER_CLIENT_ID or not NAVER_CLIENT_SECRET:
        return None
    try:
        r = requests.get(
            'https://openapi.naver.com/v1/search/blog.json',
            params={'query': query, 'display': display, 'sort': 'sim'},
            headers={
                'X-Naver-Client-Id':     NAVER_CLIENT_ID,
                'X-Naver-Client-Secret': NAVER_CLIENT_SECRET,
            },
            timeout=10,
        )
        if r.status_code == 200:
            return r.json().get('items', [])
        if r.status_code == 429:
            print('    [WARNING] Naver API quota exceeded')
            return None
    except Exception as e:
        print(f'    [ERROR] search failed: {e}')
    return []


def _check_post_rank(blog_id: str, log_no: str, query: str) -> tuple[bool, int | None]:
    """특정 쿼리로 검색해 해당 포스팅(logNo)이 몇 위에 있는지 반환."""
    items = _naver_blog_search(query, display=100)
    if items is None:
        return False, None
    for idx, item in enumerate(items, 1):
        link = item.get('link', '')
        if blog_id.lower() in link.lower() and log_no in link:
            return True, idx
    return False, None


# ── 포스팅 제목 키워드 추출 ──────────────────────────────────────────────────

_STOPWORDS = {
    '의','가','이','은','는','을','를','에','에서','과','와','로','으로','도','만',
    '한','하는','하고','더','정말','진짜','완전','너무','아주','매우','제','내',
    '그','저','것','수','등','때','후','전','중','안','위','아래','및','또는',
    '그리고','하면','부터','까지','에게',
}

def extract_keywords(title: str) -> list[str]:
    """
    포스팅 제목에서 검색용 키워드(2-gram) 추출.
    예) "인천 데이트 홍대입구 일본풍 카페" → ["인천 데이트", "데이트 홍대입구", "홍대입구 카페"]
    """
    cleaned = re.sub(r'[^\w\s]', ' ', title)
    words   = [w for w in cleaned.split() if len(w) >= 2 and w not in _STOPWORDS]
    grams   = [f'{words[i]} {words[i+1]}' for i in range(len(words) - 1)]
    return list(dict.fromkeys(grams))[:3]  # 중복 제거, 최대 3개


# ── 포스팅 단위 노출 체크 ───────────────────────────────────────────────────

def check_post_keyword_rankings(blog_id: str, posts: list) -> list:
    """
    그날 발행한 포스팅(최대 5개, 호출부에서 필터링해서 넘김)별:
      1) 제목 전체로 검색 → 해당 글 노출 여부/순위 (인덱싱 상태 확인용, 배점에는 미반영)
      2) 제목에서 추출한 키워드별 검색 → 키워드마다 노출 순위 세분화(배점 기준)
    """
    results = []
    check_posts = posts[:5]

    for post in check_posts:
        title  = unquote_plus(re.sub(r'<[^>]+>', '', post.get('title', ''))).strip()
        log_no = str(post.get('logNo', ''))
        published_on = _parse_naver_date(post.get('addDate', ''))
        if not title or not log_no:
            continue

        # ① 제목 전체 검색 (누락 여부 판단)
        found, rank = _check_post_rank(blog_id, log_no, title)
        time.sleep(random.uniform(0.3, 0.6))

        # ② 키워드별 세분화 검색
        kw_results = []
        for kw in extract_keywords(title):
            kw_found, kw_rank = _check_post_rank(blog_id, log_no, kw)
            kw_results.append({'keyword': kw, 'found': kw_found, 'rank': kw_rank})
            time.sleep(random.uniform(0.3, 0.6))

        results.append({
            'log_no':       log_no,
            'title':        title,
            'published_on': published_on.isoformat() if published_on else None,
            'found':        found,
            'rank':         rank,
            'keywords':     kw_results,
        })

        print(
            f'      "{title[:22]}..." '
            f'{"[노출] " + str(rank) + "위" if found else "[미노출]"}'
        )
        time.sleep(random.uniform(0.4, 0.8))

    return results


# ── 카테고리 키워드 보조 체크 ──────────────────────────────────────────────

def check_category_keywords(blog_id: str, categories: list[str]) -> dict:
    """카테고리 대표 키워드로 블로그 전체 노출 체크 (포스팅 체크 보완용)."""
    keywords: list[str] = []
    for cat in (categories or []):
        if cat in CATEGORY_KEYWORDS:
            keywords.extend(CATEGORY_KEYWORDS[cat])
    if not keywords:
        keywords = DEFAULT_KEYWORDS
    keywords = list(dict.fromkeys(keywords))[:3]

    results = []
    for keyword in keywords:
        found = False
        rank: int | None = None

        items = _naver_blog_search(keyword, display=100)
        if items is None:
            break

        for idx, item in enumerate(items, 1):
            blog_link = item.get('bloggerlink', '')
            link      = item.get('link', '')
            if blog_id.lower() in blog_link.lower() or blog_id.lower() in link.lower():
                found = True
                rank  = idx
                break

        results.append({'keyword': keyword, 'found': found, 'rank': rank,
                        'post_title': re.sub(r'<[^>]+>', '', items[rank-1].get('title','')) if found and rank else None})
        time.sleep(random.uniform(0.3, 0.6))

    top10 = sum(1 for r in results if r['found'] and r['rank'] is not None and r['rank'] <= 10)
    top30 = sum(1 for r in results if r['found'] and r['rank'] is not None and r['rank'] <= 30)
    return {'keyword_rankings': results, 'top10_count': top10, 'top30_count': top30}


# ── 종합 등급 계산 ─────────────────────────────────────────────────────────

def calculate_grade(data: dict, post_rankings: list) -> tuple[str, int, int]:
    """
    100점 만점 종합 등급 + 세부 등급(A-1 / A-2 / A-3 등) + 결측 항목 수 반환

    배점(측정 가능한 항목의 만점 기준으로 환산 — 결측 항목은 감점하지 않고 제외):
      일 방문자     40점  — 실제 도달력, 조작 어려운 핵심 지표
      포스팅 노출   35점  — 노출률(20) + 평균 순위 품질(15)
      포스팅 빈도   15점  — 꾸준한 활동성. None(수집 실패)은 0점이 아니라 항목 자체를 제외
      이웃 수       10점  — 참고 지표. 컷을 낮춰(300+) 소규모 블로거도 점수를 받게 함

    등급 컷(13단계): S 90+ / A 75-89 / B 60-74 / C 45-59 / D 0-44, 각 3단계 세분
    """
    earned = 0
    max_possible = 0
    missing = 0

    visitor  = data.get('visitor_today')
    freq     = data.get('post_frequency')
    neighbor = data.get('neighbor_count')

    # ① 일 방문자 (0~40)
    if visitor is None:
        missing += 1
    else:
        max_possible += 40
        if   visitor >= 50_000: earned += 40
        elif visitor >= 20_000: earned += 32
        elif visitor >= 10_000: earned += 22
        elif visitor >=  3_000: earned += 10
        elif visitor >=  1_000: earned +=  4

    # ② 포스팅 노출 (0~35) = 키워드 노출률(0~20) + 평균 순위 품질(0~15)
    # 제목 전체 검색은 자기 글 제목이므로 항상 1위 → 변별력 없어 배점에서 제외
    # 실제 사람이 검색하는 키워드(2-gram) 단위 노출률을 기준으로 배점
    all_kws     = [k for p in post_rankings for k in (p.get('keywords') or [])] if post_rankings else []
    exposed_kws = [k for k in all_kws if k.get('found') and k.get('rank')]
    if all_kws:
        max_possible += 35
        rate = len(exposed_kws) / len(all_kws)

        if   rate >= 0.9: earned += 20
        elif rate >= 0.7: earned += 15
        elif rate >= 0.5: earned += 10
        elif rate >= 0.3: earned +=  5
        elif rate  > 0:   earned +=  2

        if exposed_kws:
            avg_rank = sum(k['rank'] for k in exposed_kws) / len(exposed_kws)
            if   avg_rank <=  3: earned += 15
            elif avg_rank <= 10: earned += 12
            elif avg_rank <= 20: earned +=  8
            elif avg_rank <= 50: earned +=  4
            else:                earned +=  1
    else:
        missing += 1

    # ③ 포스팅 빈도 (0~15) — null(수집 실패)이면 0점이 아니라 항목 제외
    if freq is None:
        missing += 1
    else:
        max_possible += 15
        if   freq >= 20: earned += 15
        elif freq >= 10: earned += 10
        elif freq >=  4: earned +=  6
        elif freq >=  1: earned +=  3

    # ④ 이웃 수 (0~10) — 컷 하향, 참고 지표
    if neighbor is None:
        missing += 1
    else:
        max_possible += 10
        if   neighbor >= 100_000: earned += 10
        elif neighbor >=  30_000: earned +=  8
        elif neighbor >=  10_000: earned +=  6
        elif neighbor >=   3_000: earned +=  4
        elif neighbor >=   1_000: earned +=  2
        elif neighbor >=     300: earned +=  1

    score = round(earned / max_possible * 100) if max_possible > 0 else 0

    # 등급 + 세부 등급 (13단계)
    if score >= 90:
        return 'S', score, missing
    elif score >= 75:
        base, cuts = 'A', [85, 80]
    elif score >= 60:
        base, cuts = 'B', [70, 65]
    elif score >= 45:
        base, cuts = 'C', [55, 50]
    else:
        base, cuts = 'D', [40, 35]

    sub = 1 if score >= cuts[0] else (2 if score >= cuts[1] else 3)
    return f'{base}-{sub}', score, missing


# ── Supabase 연동 ──────────────────────────────────────────────────────────

def get_influencers(user_id: str | None = None) -> list[dict]:
    q = (
        supabase.from_('influencer_profiles')
        .select('user_id, blog_url, categories')
        .neq('blog_url', '')
        .not_.is_('blog_url', 'null')
    )
    if user_id:
        q = q.eq('user_id', user_id)
    return (q.execute().data or [])


def save_analytics(user_id: str, blog_url: str, data: dict, batch_date: date):
    # 전일 대비 방문자 차분(history.visitor_daily) — 기존 스냅샷을 덮어쓰기 전에 조회
    prev = (
        supabase.from_('blog_analytics')
        .select('visitor_total')
        .eq('user_id', user_id)
        .execute()
    )
    prev_total = prev.data[0]['visitor_total'] if prev.data else None
    visitor_total = data.get('visitor_total')
    visitor_daily = (
        visitor_total - prev_total
        if visitor_total is not None and prev_total is not None and visitor_total >= prev_total
        else None
    )

    supabase.from_('blog_analytics').upsert(
        {'user_id': user_id, 'blog_url': blog_url,
         'crawled_at': datetime.now(timezone.utc).isoformat(), **data},
        on_conflict='user_id',
    ).execute()

    if data.get('error_message'):
        return  # 크롤링 실패한 날은 이력을 남기지 않는다(측정 자체가 안 됐으므로)

    post_rankings = data.get('post_keyword_rankings') or []
    all_kws     = [k for p in post_rankings for k in (p.get('keywords') or [])]
    exposed_kws = [k for k in all_kws if k.get('found') and k.get('rank')]
    exposure_rate = round(len(exposed_kws) / len(all_kws), 3) if all_kws else None
    avg_rank      = round(sum(k['rank'] for k in exposed_kws) / len(exposed_kws), 1) if exposed_kws else None

    supabase.from_('blog_analytics_history').upsert({
        'user_id':        user_id,
        'crawled_on':     batch_date.isoformat(),
        'blog_grade':     data.get('blog_grade'),
        'grade_score':    data.get('grade_score'),
        'visitor_total':  visitor_total,
        'visitor_daily':  visitor_daily,
        'neighbor_count': data.get('neighbor_count'),
        'post_count':     data.get('post_count'),
        'post_frequency': data.get('post_frequency'),
        'exposure_rate':  exposure_rate,
        'avg_rank':       avg_rank,
        'missing_metrics': data.get('missing_metrics'),
    }, on_conflict='user_id,crawled_on').execute()


def save_post_rankings(user_id: str, batch_date: date, post_rankings: list):
    for p in post_rankings:
        kws = p.get('keywords') or []
        exposed = [k for k in kws if k.get('found') and k.get('rank')]
        supabase.from_('blog_post_rankings').upsert({
            'user_id':       user_id,
            'log_no':        p['log_no'],
            'published_on':  p.get('published_on') or batch_date.isoformat(),
            'checked_on':    batch_date.isoformat(),
            'title':         p.get('title'),
            'keywords':      kws,
            'exposure_rate': round(len(exposed) / len(kws), 3) if kws else None,
            'avg_rank':      round(sum(k['rank'] for k in exposed) / len(exposed), 1) if exposed else None,
        }, on_conflict='user_id,log_no,checked_on').execute()


# ── 메인 ──────────────────────────────────────────────────────────────────

def run(user_id: str | None = None, skip_keywords: bool = False):
    # 배치 시작일 기준으로 고정 — 자정을 넘겨도 이 실행 내내 같은 날짜를 쓴다
    batch_date = date.today()
    influencers = get_influencers(user_id)
    print(f'[블로그 분석기] 대상 {len(influencers)}명 (batch_date={batch_date})')

    for inf in influencers:
        uid        = inf['user_id']
        url        = inf['blog_url']
        categories = inf.get('categories') or []

        blog_id = extract_blog_id(url)
        if not blog_id:
            save_analytics(uid, url, {'blog_id': None, 'error_message': '네이버 블로그 URL 아님'}, batch_date)
            print(f'  [NG] {url} -- not naver blog')
            continue

        print(f'  -> {blog_id} 수집 중...')
        data, posts = fetch_blog_analytics(blog_id)

        if not skip_keywords and not data.get('error_message'):
            # 그날 발행한 포스팅만, 최대 5개 — 이전 글을 매번 다시 검사하며 호출을 낭비하지 않는다
            today_posts = [p for p in posts if _parse_naver_date(p.get('addDate', '')) == batch_date][:5]

            if today_posts:
                print(f'     posting exposure check ({len(today_posts)}, 오늘 발행분)...')
                post_rankings = check_post_keyword_rankings(blog_id, today_posts)
                data['post_keyword_rankings'] = post_rankings
                save_post_rankings(uid, batch_date, post_rankings)

                exposed_cnt = sum(1 for p in post_rankings if p['found'])
                print(f'     exposed {exposed_cnt}/{len(post_rankings)}')
            else:
                post_rankings = []
                print('     오늘 발행 글 없음 — 노출 검사 건너뜀')

            print(f'     category keywords... ({categories})')
            kw_data = check_category_keywords(blog_id, categories)
            data.update(kw_data)

            grade, gscore, missing = calculate_grade(data, post_rankings)
            data['blog_grade']     = grade
            data['grade_score']    = gscore
            data['missing_metrics'] = missing
            print(
                f'     grade: {grade} ({gscore}pt, 결측 {missing}개)  '
                f'top10:{kw_data["top10_count"]} top30:{kw_data["top30_count"]}'
            )

        save_analytics(uid, url, data, batch_date)

        if data.get('error_message'):
            print(f'  [NG] {blog_id} -- {data["error_message"]}')
        else:
            print(
                f'  [OK] {blog_id} '
                f'neighbor:{data["neighbor_count"]} '
                f'posts:{data["post_count"]} '
                f'grade:{data.get("blog_grade", "-")}'
            )

        time.sleep(random.uniform(3, 6))

    print('[완료]')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--user-id',     help='특정 인플루언서 user_id만 분석')
    parser.add_argument('--no-keywords', action='store_true', help='키워드 체크 생략')
    args = parser.parse_args()
    run(args.user_id, skip_keywords=args.no_keywords)
