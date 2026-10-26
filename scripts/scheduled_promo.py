"""공식 페이지가 열리기 전에 받은 행사를 시작 시각에 맞춰 적용한다.

변경분은 저장소에 올리지 않고 GitHub 비밀값 PENDING_PROMO에 넣어 둔다. 공개 저장소라서 브랜치에 올리면 미리 공개된다.

  pack   로컬 브랜치의 변경분으로 비밀값 내용을 만든다(표준 출력, base64).
         python3 scripts/scheduled_promo.py pack --ref octflash26 --due 2026-10-28T00:00:00Z \
             --page https://.../a/ --page https://.../b/ --fx 1325.28 2026-10-26 | gh secret set PENDING_PROMO
  apply  워크플로가 매시간 실행한다. 시작 시각이 지났고 history.yaml에 아직 없는 항목만 적용한다.

변경분 안의 자리표시자는 적용할 때 채운다.
  __LF_PAGE__, __LF_PAGE_ENC__  --page 목록에서 처음으로 200을 돌려준 주소(뒤의 것은 URL 인코딩)
  __USD_KRW__, __FX_DATE__      적용 시점의 Frankfurter 환율. 받지 못하면 --fx 값

실행 기록은 공개다. 적용 전에는 행사 이름, 시각, 내용을 출력하지 않는다.
"""
import argparse
import base64
import datetime as dt
import json
import os
import subprocess
import sys
import urllib.parse
import urllib.request

HIST = "data/promo/history.yaml"
UA = {"User-Agent": "Mozilla/5.0 (promo.kuberneteslab.dev promo-schedule)"}


def git(*args, **kw):
    return subprocess.run(["git", *args], check=True, text=True, capture_output=True, **kw).stdout


def pack(a):
    patch = git("diff", f"{a.base}...{a.ref}")
    if not patch:
        sys.exit("변경분이 없다")
    message = git("log", "-1", "--format=%B", a.ref).strip()
    names = [l.split('"')[1] for l in patch.splitlines() if l.startswith('+    name: "')]
    if len(names) != 1:
        sys.exit("변경분에서 행사 이름(name)을 하나만 찾아야 한다")
    item = {
        "name": names[0],
        "due": a.due,
        "pages": a.page,
        "fx_fallback": {"usd_krw": a.fx[0], "fx_date": a.fx[1]},
        "message": message,
        "patch": patch,
    }
    print(base64.b64encode(json.dumps([item], ensure_ascii=False).encode()).decode())


def utc(s):
    return dt.datetime.fromisoformat(s.replace("Z", "+00:00"))


def first_open(pages):
    for url in pages:
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30) as r:
                if r.status == 200:
                    return url
        except Exception:
            pass
    return None


def fx(fallback):
    try:
        with urllib.request.urlopen("https://api.frankfurter.dev/v1/latest?base=USD&symbols=KRW", timeout=30) as r:
            d = json.load(r)
        return str(d["rates"]["KRW"]), d["date"]
    except Exception:
        return str(fallback["usd_krw"]), fallback["fx_date"]


def apply(a):
    raw = os.environ.get("PENDING_PROMO", "").strip()
    if not raw:
        print("예약 없음")
        return
    items = json.loads(base64.b64decode(raw))
    now = utc(os.environ["PROMO_NOW"]) if os.environ.get("PROMO_NOW") else dt.datetime.now(dt.timezone.utc)
    applied = []
    for it in sorted(items, key=lambda x: x["due"]):
        if f'name: "{it["name"]}"' in open(HIST, encoding="utf-8").read():
            continue
        if now < utc(it["due"]):
            print("대기 중")
            continue
        page = first_open(it["pages"])
        if not page:
            print("행사 페이지가 아직 열리지 않아 다음 실행에서 다시 확인한다")
            continue
        rate, date = fx(it["fx_fallback"])
        patch = (it["patch"]
                 .replace("__LF_PAGE_ENC__", urllib.parse.quote(page, safe=""))
                 .replace("__LF_PAGE__", page)
                 .replace("__USD_KRW__", rate)
                 .replace("__FX_DATE__", date))
        git("apply", "--index", "-", input=patch)
        git("commit", "-q", "-m", it["message"])
        applied.append(it["name"])
        print(f"적용: {it['name']} (페이지 {page}, 환율 {rate} {date})")
    if not applied:
        return
    if a.dry_run:
        print(git("diff", "--stat", f"HEAD~{len(applied)}"))
        return
    git("push", "origin", "HEAD:main")
    subprocess.run(["gh", "workflow", "run", "deploy.yml", "--ref", "main"], check=True)
    print("푸시하고 배포를 실행했다")


def main():
    p = argparse.ArgumentParser()
    sub = p.add_subparsers(dest="cmd", required=True)
    pk = sub.add_parser("pack")
    pk.add_argument("--ref", required=True)
    pk.add_argument("--base", default="origin/main")
    pk.add_argument("--due", required=True)
    pk.add_argument("--page", action="append", required=True)
    pk.add_argument("--fx", nargs=2, required=True, metavar=("USD_KRW", "FX_DATE"))
    ap = sub.add_parser("apply")
    ap.add_argument("--dry-run", action="store_true")
    a = p.parse_args()
    pack(a) if a.cmd == "pack" else apply(a)


if __name__ == "__main__":
    main()
