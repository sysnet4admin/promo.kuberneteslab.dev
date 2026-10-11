// /go/ 와 /out/ 함수가 함께 쓰는 것들: 행사 목록 조회, 언어 판단, 404, "끝났습니다" 안내 페이지.
// 끝난 행사 안내는 자동으로 어디로도 넘기지 않는다. 제휴 링크는 독자가 버튼을 눌렀을 때만 거친다.

// 상시 할인 코드와 그 코드로 갈 카탈로그 링크. 코드가 바뀌면 content/*/_index.md 배너와 함께 고친다.
export const STANDING_CODE = 'KUBELAB30';
const CATALOG_LINK = '/go/lf';

export const STYLE = `:root { color-scheme: light dark; --bg: #fff; --fg: #1e1e1e; --sub: #6c6c6c; --accent: #326CE5; --code-bg: #f3f3f5; --border: #d9d9de; }
  @media (prefers-color-scheme: dark) { :root { --bg: #1d1e20; --fg: #dadadb; --sub: #9b9c9d; --code-bg: #2a2b2e; --border: #3a3b3f; } }
  html, body { margin: 0; height: 100%; background: var(--bg); color: var(--fg);
    font-family: -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Noto Sans KR", "Segoe UI", sans-serif; }
  main { min-height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 16px; padding: 24px; box-sizing: border-box; text-align: center; word-break: keep-all; }
  .spin { width: 36px; height: 36px; border: 4px solid color-mix(in srgb, var(--accent) 25%, transparent);
    border-top-color: var(--accent); border-radius: 50%; animation: s 0.9s linear infinite; }
  @keyframes s { to { transform: rotate(360deg); } }
  h1 { font-size: 1.375rem; font-weight: 600; margin: 0; }
  p { margin: 0; color: var(--sub); font-size: 1rem; line-height: 1.6; }
  a.btn { display: inline-block; margin-top: 4px; padding: 0.55em 1.1em; border-radius: 6px; background: var(--accent);
    color: #fff; font-weight: 600; text-decoration: none; }
  a.go { color: var(--accent); font-weight: 600; font-size: 1.05rem; text-underline-offset: 3px; }
  a.sub { color: var(--sub); font-size: 0.95rem; }
  .code-row { display: flex; align-items: center; gap: 0.6em; }
  .code-row code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 1.05rem;
    background: var(--code-bg); border: 1px solid var(--border); border-radius: 4px; padding: 0.3em 0.6em; color: var(--accent);
    user-select: all; }
  .code-row button { font: inherit; font-size: 0.95rem; padding: 0.35em 0.9em; border-radius: 6px; border: 0;
    background: var(--accent); color: #fff; cursor: pointer; }
  h1, p { text-wrap: balance; }
  /* 휴대폰에서는 제목이 한 줄에 들어가게 줄인다. 그래도 넘치면 두 줄 길이를 맞춘다. */
  @media (max-width: 480px) { h1 { font-size: 1.125rem; } .spin { width: 32px; height: 32px; } }
  .nojs { display: none; }
  .late { display: none; }
  .is-late .late { display: block; }`;

export const TEXT = {
  ko: { title: '리눅스 재단 페이지로 이동하고 있습니다', desc: '리눅스 재단 서버가 응답하는&nbsp;데 몇 초 걸릴 수 있습니다.', late: '넘어가지 않으면 아래 버튼을 눌러 주세요.', retry: '다시 시도', button: '리눅스 재단 페이지로 가기', nojsTitle: '리눅스 재단 페이지로 이동합니다', nojsDesc: '아래 버튼을 눌러 주세요.', doc: '리눅스 재단 페이지로 이동 중',
    endedTitle: (n, d) => `${n} 할인은 ${d}에 끝났습니다`, endedDesc: '지금은 상시 할인 30% 코드를 쓰실 수 있습니다.', copy: '복사', copied: '복사됨', catalog: '리눅스 재단 카탈로그로 이동 →', history: '할인 기록과 다음 할인 시기 보기', endedDoc: '끝난 할인 행사', home: '/ko/' },
  en: { title: 'Taking you to the Linux Foundation', desc: 'Their server can take a few seconds to respond.', late: 'If nothing happens, press the button below.', retry: 'Try again', button: 'Go to the Linux Foundation', nojsTitle: 'Continue to the Linux Foundation', nojsDesc: 'Press the button below.', doc: 'Taking you to the Linux Foundation',
    endedTitle: (n, d) => `The ${n} sale ended on ${d}`, endedDesc: 'The year-round 30% code works right now.', copy: 'Copy', copied: 'Copied', catalog: 'Go to the Linux Foundation catalog →', history: 'See past discounts and the next sale window', endedDoc: 'This sale has ended', home: '/en/' },
};

export const HTML_HEADERS = { 'content-type': 'text/html; charset=utf-8', 'x-robots-tag': 'noindex, nofollow', 'cache-control': 'no-store' };

export function pickLang(request) {
  const ref = request.headers.get('Referer') || '';
  if (/\/en\//.test(ref)) return 'en';
  if (/\/ko\//.test(ref)) return 'ko';
  const al = (request.headers.get('Accept-Language') || '').toLowerCase();
  return al.startsWith('en') ? 'en' : 'ko';
}

export function notFound(env, origin) {
  return env.ASSETS.fetch(new Request(new URL('/404', origin)))
    .then((r) => new Response(r.body, { status: 404, headers: HTML_HEADERS }));
}

// 행사 링크 목록(빌드 때 history.yaml에서 만든 /ko/golinks.json)에서 이름을 찾아, 종료 시각이 지났으면 그 행사를 돌려준다.
// 목록을 읽지 못하면 빈 목록으로 보고 진행 중 링크를 그대로 보낸다. 막는 쪽을 택하면 진행 중 링크까지 막히기 때문이다.
// 그래서 끝난 행사의 /out/ 줄은 이 검사에 기대지 않고 행사 정리 때 지운다.
export async function endedPromo(env, origin, name) {
  let links = [];
  try {
    const r = await env.ASSETS.fetch(new Request(new URL('/ko/golinks.json', origin)));
    if (r.ok) links = await r.json();
  } catch (e) { links = []; }
  const promo = links.find((x) => x.slug === name);
  return promo && Date.now() >= Date.parse(promo.end) ? promo : null;
}

export function endedPage(promo, lang) {
  const t = TEXT[lang];
  const end = new Date(promo.end);
  const date = lang === 'ko'
    ? new Date(end.getTime() + 9 * 3600 * 1000).toISOString().replace(/^(\d+)-(\d+)-(\d+).*$/, (m, y, mo, d) => `${+mo}월 ${+d}일`)
    : end.toLocaleDateString('en-US', { timeZone: 'UTC', month: 'long', day: 'numeric' });
  const esc = (x) => String(x).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const html = `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${t.endedDoc}</title>
<style>
${STYLE}
</style>
</head>
<body>
<main>
  <h1>${esc(t.endedTitle(promo.name, date))}</h1>
  <p>${t.endedDesc}</p>
  <div class="code-row"><code id="code">${STANDING_CODE}</code><button type="button" id="copy" hidden>${t.copy}</button></div>
  <a class="go" href="${CATALOG_LINK}" rel="nofollow sponsored">${t.catalog}</a>
  <a class="sub" href="${t.home}">${t.history}</a>
</main>
<script>
(function () {
  var b = document.getElementById('copy');
  if (!navigator.clipboard) return;
  b.hidden = false;
  b.addEventListener('click', function () {
    navigator.clipboard.writeText(${JSON.stringify(STANDING_CODE)}).then(function () {
      b.textContent = ${JSON.stringify(t.copied)};
      setTimeout(function () { b.textContent = ${JSON.stringify(t.copy)}; }, 1500);
    });
  });
})();
</script>
</body>
</html>`;
  return new Response(html, { headers: HTML_HEADERS });
}
