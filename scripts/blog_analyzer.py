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
from datetime import datetime, date, timedelta
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
    최근 포스팅별:
      1) 제목 전체로 검색 → 해당 글 노출 여부/순위 (인덱싱 상태 확인)
      2) 제목에서 추출한 키워드별 검색 → 키워드마다 노출 순위 세분화
    """
    results = []
    check_posts = posts[:7]

    for post in check_posts:
        title  = unquote_plus(re.sub(r'<[^>]+>', '', post.get('title', ''))).strip()
        log_no = str(post.get('logNo', ''))
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
            'log_no':   log_no,
            'title':    title,
            'found':    found,
            'rank':     rank,
            'keywords': kw_results,
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

def calculate_grade(data: dict, post_rankings: list) -> tuple[str, int]:
    """
    100점 만점 종합 등급 + 세부 등급(A-1 / A-2 / A-3 등) 반환

    배점:
      일 방문자     40점  — 실제 도달력, 조작 어려운 핵심 지표
      포스팅 노출   35점  — 노출률(20) + 평균 순위 품질(15)
      포스팅 빈도   15점  — 꾸준한 활동성
      이웃 수       10점  — 참고 지표 (팔로워 매입 가능하므로 비중 낮춤)

    등급 컷: S ≥ 75 / A ≥ 55 / B ≥ 35 / C ≥ 15 / D
    세부:    X-1(상위 1/3) / X-2(중간) / X-3(하위 1/3)
    """
    score = 0

    visitor  = data.get('visitor_today')  or 0
    freq     = data.get('post_frequency') or 0.0
    neighbor = data.get('neighbor_count') or 0

    # ① 일 방문자 (0~40) — 1만이 광고 활용 최소선
    if   visitor >= 50_000: score += 40
    elif visitor >= 20_000: score += 32
    elif visitor >= 10_000: score += 22
    elif visitor >=  3_000: score += 10
    elif visitor >=  1_000: score +=  4

    # ② 포스팅 노출 (0~35) = 키워드 노출률(0~20) + 평균 순위 품질(0~15)
    # 제목 전체 검색은 자기 글 제목이므로 항상 1위 → 변별력 없음
    # 실제 사람이 검색하는 키워드(2-gram) 단위 노출률을 기준으로 배점
    if post_rankings:
        all_kws     = [k for p in post_rankings for k in (p.get('keywords') or [])]
        exposed_kws = [k for k in all_kws if k.get('found') and k.get('rank')]
        if all_kws:
            rate = len(exposed_kws) / len(all_kws)

            # 노출률 점수 (0~20)
            if   rate >= 0.9: score += 20
            elif rate >= 0.7: score += 15
            elif rate >= 0.5: score += 10
            elif rate >= 0.3: score +=  5
            elif rate  > 0:   score +=  2

            # 평균 순위 품질 점수 (0~15) — 노출된 키워드들의 평균 순위 기준
            if exposed_kws:
                avg_rank = sum(k['rank'] for k in exposed_kws) / len(exposed_kws)
                if   avg_rank <=  3: score += 15
                elif avg_rank <= 10: score += 12
                elif avg_rank <= 20: score +=  8
                elif avg_rank <= 50: score +=  4
                else:                score +=  1

    # ③ 포스팅 빈도 (0~15)
    if   freq >= 20: score += 15
    elif freq >= 10: score += 10
    elif freq >=  4: score +=  6
    elif freq >=  1: score +=  3

    # ④ 이웃 수 (0~10) — 참고 지표
    if   neighbor >= 100_000: score += 10
    elif neighbor >=  30_000: score +=  7
    elif neighbor >=  10_000: score +=  4
    elif neighbor >=   3_000: score +=  2

    # 등급 + 세부 등급 계산
    if   score >= 75:
        base = 'S'
        cuts = [90, 83]   # S-1 ≥90, S-2 ≥83, S-3 ≥75
    elif score >= 55:
        base = 'A'
        cuts = [69, 62]   # A-1 ≥69, A-2 ≥62, A-3 ≥55
    elif score >= 35:
        base = 'B'
        cuts = [49, 42]   # B-1 ≥49, B-2 ≥42, B-3 ≥35
    elif score >= 15:
        base = 'C'
        cuts = [29, 22]   # C-1 ≥29, C-2 ≥22, C-3 ≥15
    else:
        return 'D', score

    sub = 1 if score >= cuts[0] else (2 if score >= cuts[1] else 3)
    return f'{base}-{sub}', score


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


def save_analytics(user_id: str, blog_url: str, data: dict):
    supabase.from_('blog_analytics').upsert(
        {'user_id': user_id, 'blog_url': blog_url,
         'crawled_at': datetime.utcnow().isoformat(), **data},
        on_conflict='user_id',
    ).execute()


# ── 메인 ──────────────────────────────────────────────────────────────────

def run(user_id: str | None = None, skip_keywords: bool = False):
    influencers = get_influencers(user_id)
    print(f'[블로그 분석기] 대상 {len(influencers)}명')

    for inf in influencers:
        uid        = inf['user_id']
        url        = inf['blog_url']
        categories = inf.get('categories') or []

        blog_id = extract_blog_id(url)
        if not blog_id:
            save_analytics(uid, url, {'blog_id': None, 'error_message': '네이버 블로그 URL 아님'})
            print(f'  [NG] {url} -- not naver blog')
            continue

        print(f'  -> {blog_id} 수집 중...')
        data, posts = fetch_blog_analytics(blog_id)

        if not skip_keywords and not data.get('error_message'):
            print(f'     posting exposure check ({len(posts[:7])})...')
            post_rankings = check_post_keyword_rankings(blog_id, posts)
            data['post_keyword_rankings'] = post_rankings

            exposed_cnt = sum(1 for p in post_rankings if p['found'])
            print(f'     exposed {exposed_cnt}/{len(post_rankings)}')

            print(f'     category keywords... ({categories})')
            kw_data = check_category_keywords(blog_id, categories)
            data.update(kw_data)

            grade, gscore = calculate_grade(data, post_rankings)
            data['blog_grade'] = grade
            print(f'     grade: {grade} ({gscore}pt)  top10:{kw_data["top10_count"]} top30:{kw_data["top30_count"]}')

        save_analytics(uid, url, data)

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
