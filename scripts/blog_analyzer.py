"""
MatchPost 블로그 분석기 — 네이버 블로그
Supabase influencer_profiles.blog_url 을 읽어 자동 수집 → blog_analytics 테이블에 저장

실행:
  pip install requests beautifulsoup4 supabase python-dotenv
  python scripts/blog_analyzer.py              # 전체 실행
  python scripts/blog_analyzer.py --user-id <uuid>  # 특정 유저만
  python scripts/blog_analyzer.py --no-keywords     # 키워드 순위 체크 생략
"""

import os
import re
import time
import random
import argparse
import json as _json
from datetime import datetime, date, timedelta
from urllib.parse import urlparse

import requests
from bs4 import BeautifulSoup
from supabase import create_client
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env.local'))

SUPABASE_URL = os.environ['NEXT_PUBLIC_SUPABASE_URL']
SUPABASE_KEY = os.environ['SUPABASE_SERVICE_ROLE_KEY']
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

# 카테고리별 대표 검색 키워드 (각 5개, 상위 노출 체크용)
CATEGORY_KEYWORDS: dict[str, list[str]] = {
    '스타일':          ['스타일링 추천', '코디 추천', '데일리룩', '봄 코디', '가을 코디'],
    '패션':            ['패션 추천', '옷 코디', '쇼핑 후기', '패션 리뷰', '브랜드 추천'],
    '뷰티':            ['뷰티 리뷰', '화장품 추천', '메이크업', '스킨케어 추천', '내돈내산 화장품'],
    '라이프':          ['일상 브이로그', '라이프스타일', '생활 꿀팁', '일상 공유', '라이프 추천'],
    '리빙':            ['인테리어 추천', '리빙 제품', '집꾸미기', '홈데코', '주방용품 추천'],
    '육아':            ['육아 일기', '아기 용품 추천', '임신 출산', '육아 꿀팁', '유아 교육'],
    '생활건강':        ['건강 관리', '다이어트 식단', '건강식품 추천', '영양제 추천', '건강 꿀팁'],
    '푸드':            ['맛집 추천', '레시피', '음식 리뷰', '맛집 탐방', '홈쿡 레시피'],
    '여행':            ['국내여행', '해외여행 추천', '여행지 추천', '여행 코스', '여행 후기'],
    '동물/펫':         ['반려동물 용품', '강아지 추천', '고양이 추천', '펫 케어', '반려견 훈련'],
    '스포츠/운동/레저': ['운동 루틴', '헬스 추천', '다이어트 운동', '스포츠 용품', '홈트 추천'],
    '프로스포츠':      ['프로야구 분석', '축구 중계', '스포츠 뉴스', 'KBO 분석', '축구 분석'],
    '게임':            ['게임 리뷰', '게임 공략', '신규 게임', '모바일 게임 추천', 'PC 게임'],
    '테크/IT':         ['IT 제품 리뷰', '전자제품 추천', '스마트폰 리뷰', '앱 추천', '노트북 추천'],
    '자동차':          ['자동차 리뷰', '신차 시승기', '자동차 추천', '자동차 용품', '전기차 추천'],
    '방송/연예':       ['연예 뉴스', '드라마 추천', 'TV 프로그램', '예능 추천', '드라마 리뷰'],
    '대중음악':        ['음악 추천', '앨범 리뷰', '신곡 추천', '플레이리스트', 'K팝 추천'],
    '컬처':            ['문화 리뷰', '문화생활', '전시회 추천', '공연 후기', '뮤지컬 추천'],
    '영화/공연/전시/예술': ['영화 리뷰', '공연 추천', '전시회 후기', '미술관', '뮤지컬 리뷰'],
    '도서':            ['책 추천', '독서 후기', '도서 리뷰', '책 리뷰', '베스트셀러'],
    '경제/비즈니스':   ['재테크', '투자 정보', '주식 추천', '경제 뉴스', '부동산 정보'],
    '어학/교육':       ['영어 공부법', '학습법 추천', '자격증 공부', '어학 추천', '공부 꿀팁'],
    '기타':            ['생활 정보', '일상 공유', '블로그 추천', '솔직 후기', '사용 후기'],
}
DEFAULT_KEYWORDS = ['블로그 추천', '일상 공유', '솔직 후기', '생활 정보', '사용 후기']


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


def fetch_blog_analytics(blog_id: str) -> dict:
    result: dict = {
        'blog_id': blog_id,
        'neighbor_count': None,
        'visitor_today': None,
        'visitor_total': None,
        'post_count': None,
        'avg_likes': None,
        'avg_comments': None,
        'last_post_date': None,
        'post_frequency': None,
        'error_message': None,
    }

    # ── 1. 모바일 메인 페이지 ─────────────────────────────────────────────
    r = _get(f'https://m.blog.naver.com/{blog_id}', mobile=True)
    if not r:
        result['error_message'] = '블로그 페이지 접근 실패'
        return result

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
                def parse_naver_date(s: str) -> date | None:
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

                latest_date = parse_naver_date(posts[0].get('addDate', ''))
                if latest_date:
                    result['last_post_date'] = latest_date.isoformat()

                comment_counts = []
                for p in posts:
                    cc = p.get('commentCount', '')
                    if str(cc).isdigit():
                        comment_counts.append(int(cc))
                if comment_counts:
                    result['avg_comments'] = round(
                        sum(comment_counts) / len(comment_counts), 1
                    )

                dated_posts = []
                for p in posts:
                    d = parse_naver_date(p.get('addDate', ''))
                    if d:
                        dated_posts.append(d)
                if len(dated_posts) >= 2:
                    span_days = (dated_posts[0] - dated_posts[-1]).days or 1
                    result['post_frequency'] = round(
                        len(dated_posts) / max(span_days, 1) * 30, 1
                    )

        except Exception as e:
            result['error_message'] = f'포스트 목록 파싱 오류: {e}'

    return result


# ── 키워드 검색 순위 체크 ───────────────────────────────────────────────────

def check_keyword_rankings(blog_id: str, categories: list[str]) -> dict:
    """네이버 블로그 검색 API로 카테고리 키워드별 상위 노출 여부 체크"""
    if not NAVER_CLIENT_ID or not NAVER_CLIENT_SECRET:
        return {'keyword_rankings': None, 'top10_count': 0, 'top30_count': 0}

    # 카테고리 기반 키워드 수집 (최대 5개)
    keywords: list[str] = []
    for cat in (categories or []):
        if cat in CATEGORY_KEYWORDS:
            keywords.extend(CATEGORY_KEYWORDS[cat])
    if not keywords:
        keywords = DEFAULT_KEYWORDS
    keywords = list(dict.fromkeys(keywords))[:5]  # 중복 제거

    results = []
    for keyword in keywords:
        found = False
        rank: int | None = None
        post_title: str | None = None

        try:
            r = requests.get(
                'https://openapi.naver.com/v1/search/blog.json',
                params={'query': keyword, 'display': 100, 'sort': 'sim'},
                headers={
                    'X-Naver-Client-Id': NAVER_CLIENT_ID,
                    'X-Naver-Client-Secret': NAVER_CLIENT_SECRET,
                },
                timeout=10,
            )
            if r.status_code == 200:
                data = r.json()
                for idx, item in enumerate(data.get('items', []), 1):
                    blog_link = item.get('bloggerlink', '')
                    link      = item.get('link', '')
                    # blog_id 가 링크 어딘가에 포함되면 이 블로그 글
                    if (blog_id.lower() in blog_link.lower() or
                            blog_id.lower() in link.lower()):
                        found = True
                        rank = idx
                        post_title = re.sub(r'<[^>]+>', '', item.get('title', ''))
                        break
            elif r.status_code == 429:
                print(f'    [경고] 네이버 API 한도 초과 — 키워드 체크 중단')
                break
        except Exception as e:
            print(f'    [오류] 키워드 "{keyword}" 체크 실패: {e}')

        results.append({
            'keyword':    keyword,
            'found':      found,
            'rank':       rank,
            'post_title': post_title,
        })

        time.sleep(random.uniform(0.3, 0.7))  # API 부하 최소화

    top10 = sum(1 for r in results if r['found'] and r['rank'] is not None and r['rank'] <= 10)
    top30 = sum(1 for r in results if r['found'] and r['rank'] is not None and r['rank'] <= 30)

    return {
        'keyword_rankings': results,
        'top10_count':      top10,
        'top30_count':      top30,
    }


# ── Supabase 연동 ──────────────────────────────────────────────────────────

def get_influencers(user_id: str | None = None) -> list[dict]:
    q = supabase.from_('influencer_profiles') \
        .select('user_id, blog_url, categories') \
        .neq('blog_url', '') \
        .not_.is_('blog_url', 'null')
    if user_id:
        q = q.eq('user_id', user_id)
    res = q.execute()
    return res.data or []


def save_analytics(user_id: str, blog_url: str, data: dict):
    supabase.from_('blog_analytics').upsert({
        'user_id':    user_id,
        'blog_url':   blog_url,
        'crawled_at': datetime.utcnow().isoformat(),
        **data,
    }, on_conflict='user_id').execute()


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
            save_analytics(uid, url, {
                'blog_id':       None,
                'error_message': '네이버 블로그 URL이 아님',
            })
            print(f'  [NG] {url} -- not naver blog')
            continue

        print(f'  → {blog_id} 수집 중...')
        data = fetch_blog_analytics(blog_id)

        if not skip_keywords and not data.get('error_message'):
            print(f'     키워드 순위 체크 중... (카테고리: {categories})')
            kw_data = check_keyword_rankings(blog_id, categories)
            data.update(kw_data)
            print(
                f'     top10: {kw_data["top10_count"]}건 / '
                f'top30: {kw_data["top30_count"]}건 '
                f'(체크 {len(kw_data["keyword_rankings"] or [])}개 키워드)'
            )

        save_analytics(uid, url, data)

        if data.get('error_message'):
            print(f'  [NG] {blog_id} -- {data["error_message"]}')
        else:
            print(
                f'  [OK] {blog_id} '
                f'neighbor:{data["neighbor_count"]} '
                f'posts:{data["post_count"]} '
                f'last:{data["last_post_date"]}'
            )

        time.sleep(random.uniform(3, 6))

    print('[완료]')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--user-id',      help='특정 인플루언서 user_id만 분석')
    parser.add_argument('--no-keywords',  action='store_true', help='키워드 순위 체크 생략')
    args = parser.parse_args()
    run(args.user_id, skip_keywords=args.no_keywords)
