"""
MatchPost 블로그 분석기 — 네이버 블로그
Supabase influencer_profiles.blog_url 을 읽어 자동 수집 → blog_analytics 테이블에 저장

실행:
  pip install requests beautifulsoup4 supabase python-dotenv
  python scripts/blog_analyzer.py              # 전체 실행
  python scripts/blog_analyzer.py --user-id <uuid>  # 특정 유저만
"""

import os
import re
import time
import random
import argparse
from datetime import datetime, date
from urllib.parse import urlparse

import requests
from bs4 import BeautifulSoup
from supabase import create_client
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env.local'))

SUPABASE_URL = os.environ['NEXT_PUBLIC_SUPABASE_URL']
SUPABASE_KEY = os.environ['SUPABASE_SERVICE_ROLE_KEY']

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


# ── URL 파싱 ────────────────────────────────────────────────────────────────

def extract_blog_id(url: str) -> str | None:
    """네이버 블로그 URL에서 blog ID 추출"""
    url = url.strip()
    if not url:
        return None
    if not url.startswith('http'):
        url = 'https://' + url

    parsed = urlparse(url)
    if 'blog.naver.com' not in parsed.netloc:
        return None  # 네이버 블로그 아님

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
    """블로그 ID로 네이버 블로그 지표 수집"""

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

    # 이웃/팬 수
    for tag in soup.find_all(string=re.compile(r'이웃|팬')):
        parent = tag.find_parent()
        if parent:
            nums = re.findall(r'[\d,]+', parent.get_text())
            if nums:
                result['neighbor_count'] = int(nums[0].replace(',', ''))
                break

    # 방문자 수 (공개된 경우)
    visitor_text = soup.find(string=re.compile(r'오늘\s*방문'))
    if visitor_text:
        nums = re.findall(r'[\d,]+', visitor_text.find_parent().get_text())
        if len(nums) >= 1:
            result['visitor_today'] = int(nums[0].replace(',', ''))
        if len(nums) >= 2:
            result['visitor_total'] = int(nums[1].replace(',', ''))

    # ── 2. 포스트 목록 API ────────────────────────────────────────────────
    r2 = _get(
        f'https://blog.naver.com/PostTitleListAsync.naver'
        f'?blogId={blog_id}&viewdate=&currentPage=1&categoryNo=&countPerPage=10&orderby=desc'
    )
    if r2:
        try:
            data = r2.json()
            posts = data.get('postList', [])
            if posts:
                result['post_count'] = data.get('totalCount')

                # 최근 포스팅 날짜
                latest = posts[0].get('addDate', '')
                if latest:
                    try:
                        result['last_post_date'] = datetime.strptime(
                            latest[:10], '%Y-%m-%d'
                        ).date().isoformat()
                    except ValueError:
                        pass

                # 포스팅 빈도 (최근 10개 날짜 기준 월 평균)
                dates = []
                for p in posts:
                    d = p.get('addDate', '')[:10]
                    if d:
                        try:
                            dates.append(datetime.strptime(d, '%Y-%m-%d').date())
                        except ValueError:
                            pass
                if len(dates) >= 2:
                    span_days = (dates[0] - dates[-1]).days or 1
                    result['post_frequency'] = round(len(dates) / span_days * 30, 1)
        except Exception:
            pass

    # ── 3. 개별 포스트 공감/댓글 (최근 5개) ──────────────────────────────
    r3 = _get(
        f'https://blog.naver.com/PostList.naver'
        f'?blogId={blog_id}&widgetTypeCall=true&noCache=true'
    )
    if r3:
        soup3 = BeautifulSoup(r3.text, 'html.parser')
        likes, comments = [], []

        # 공감 수
        for el in soup3.select('.sympathyBox .num, .like_count, .pcol2'):
            txt = el.get_text(strip=True).replace(',', '')
            if txt.isdigit():
                likes.append(int(txt))

        # 댓글 수
        for el in soup3.select('.commentBox .num, .comment_count'):
            txt = el.get_text(strip=True).replace(',', '')
            if txt.isdigit():
                comments.append(int(txt))

        if likes:
            result['avg_likes'] = round(sum(likes[:10]) / len(likes[:10]), 1)
        if comments:
            result['avg_comments'] = round(sum(comments[:10]) / len(comments[:10]), 1)

    return result


# ── Supabase 연동 ──────────────────────────────────────────────────────────

def get_influencers(user_id: str | None = None) -> list[dict]:
    """blog_url이 있는 인플루언서 목록 조회"""
    q = supabase.from_('influencer_profiles') \
        .select('user_id, blog_url') \
        .neq('blog_url', '') \
        .not_.is_('blog_url', 'null')
    if user_id:
        q = q.eq('user_id', user_id)
    res = q.execute()
    return res.data or []


def save_analytics(user_id: str, blog_url: str, data: dict):
    """분석 결과 upsert"""
    supabase.from_('blog_analytics').upsert({
        'user_id': user_id,
        'blog_url': blog_url,
        'crawled_at': datetime.utcnow().isoformat(),
        **data,
    }, on_conflict='user_id').execute()


# ── 메인 ──────────────────────────────────────────────────────────────────

def run(user_id: str | None = None):
    influencers = get_influencers(user_id)
    print(f'[블로그 분석기] 대상 {len(influencers)}명')

    for inf in influencers:
        uid = inf['user_id']
        url = inf['blog_url']

        blog_id = extract_blog_id(url)
        if not blog_id:
            save_analytics(uid, url, {
                'blog_id': None,
                'error_message': '네이버 블로그 URL이 아님',
            })
            print(f'  ✗ {url} — 네이버 블로그 아님')
            continue

        print(f'  → {blog_id} 수집 중...')
        data = fetch_blog_analytics(blog_id)
        save_analytics(uid, url, data)

        if data['error_message']:
            print(f'  ✗ {blog_id} — {data["error_message"]}')
        else:
            print(
                f'  ✓ {blog_id} '
                f'이웃:{data["neighbor_count"]} '
                f'글:{data["post_count"]} '
                f'최근:{data["last_post_date"]}'
            )

        # 요청 간격 (네이버 봇 감지 방지)
        time.sleep(random.uniform(3, 6))

    print('[완료]')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--user-id', help='특정 인플루언서 user_id만 분석')
    args = parser.parse_args()
    run(args.user_id)
