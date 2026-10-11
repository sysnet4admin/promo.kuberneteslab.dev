"""리눅스 재단 교육 사이트에서 새 할인 코드를 찾는다.

사이트맵(page, post)에서 최근 며칠 사이에 생기거나 바뀐 페이지를 골라 본문의 할인 코드를 뽑고,
data/promo/history.yaml에 없는 코드만 출력한다. 출력은 GitHub Actions가 이슈로 연다.
Awin 메일로 오지 않는 행사(컨퍼런스 참석자 혜택 등)를 놓치지 않으려는 용도다. 사이트는 바꾸지 않는다.
"""
import datetime as dt
import html
import json
import re
import sys
import urllib.request

BASE = "https://training.linuxfoundation.org"
SITEMAPS = ["/page-sitemap.xml", "/post-sitemap.xml"]
DAYS = 3  # 하루 이틀 실행이 빠져도 놓치지 않게 여유를 둔다
KNOWN_EXTRA = {"KUBELAB30"}
UA = {"User-Agent": "Mozilla/5.0 (promo.kuberneteslab.dev lf-promo-watch)"}


def get(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read().decode("utf-8", "ignore")


def known_codes():
    text = open("data/promo/history.yaml", encoding="utf-8").read()
    codes = set(KNOWN_EXTRA)
    for line in re.findall(r'^\s*(?:codes|code_single|code_bundle):\s*"([^"]*)"', text, re.M):
        codes.update(re.findall(r"[A-Z0-9]{4,}", line))
    return codes


def is_known(code, known):
    # 기록한 행사의 다른 코드(OCTPRIME26CC를 기록했으면 OCTPRIME26SB)는 같은 행사로 본다
    if code in known:
        return True
    return any(len(k.rstrip("ABCDEFGHIJKLMNOPQRSTUVWXYZ")) >= 6 and code.startswith(k.rstrip("ABCDEFGHIJKLMNOPQRSTUVWXYZ")) for k in known)


def recent_pages(today):
    since = today - dt.timedelta(days=DAYS)
    for sm in SITEMAPS:
        xml = get(BASE + sm)
        for loc, mod in re.findall(r"<loc>([^<]+)</loc>\s*<lastmod>([^<]+)</lastmod>", xml):
            if "/ja/" in loc:
                continue
            if dt.date.fromisoformat(mod[:10]) >= since:
                yield loc, mod[:10]


def page_text(url):
    s = get(url)
    s = re.sub(r"<(script|style|noscript)[^>]*>.*?</\1>", " ", s, flags=re.S)
    return html.unescape(re.sub(r"<[^>]+>", "\n", s))


CODE_RE = r"([A-Z][A-Z0-9]{4,23})"
PATTERNS = [
    # "Copy Code: OCTPRIME26CC", "use code SUMMER26" 처럼 코드라는 말 바로 뒤
    r"(?:copy code|coupon code|promo code|use code|with code)\s*:?\s*" + CODE_RE + r"\b",
    # "Save 40%" 바로 아래 줄에 코드만 있는 형식(osseu-2026 페이지)
    r"save\s+\d{2}%[^\n]{0,40}\n\s*(?:copy code:?\s*\n\s*)?" + CODE_RE + r"\s*\n",
]


def find_codes(text):
    found = {}
    for pat in PATTERNS:
        for m in re.finditer(pat, text, re.I):
            code = m.group(1)
            if code.upper() == code and re.search(r"\d", code):
                pct = re.findall(r"(\d{2})%", text[max(0, m.start() - 120):m.end() + 40])
                found.setdefault(code, set()).update(pct)
    return found


def main():
    today = dt.date.fromisoformat(sys.argv[1]) if len(sys.argv) > 1 else dt.datetime.now(dt.timezone.utc).date()
    known = known_codes()
    results = []
    for url, mod in recent_pages(today):
        try:
            codes = find_codes(page_text(url))
        except Exception as e:  # 한 페이지가 실패해도 나머지는 본다
            print(f"skip {url}: {e}", file=sys.stderr)
            continue
        new = {c: sorted(p) for c, p in codes.items() if not is_known(c, known)}
        if new:
            results.append({"url": url, "lastmod": mod, "codes": new})
    print(json.dumps(results, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
