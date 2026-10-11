// /go/<이름>: "이동 중" 안내 페이지를 이름을 넣어 내보낸다.
// 등록 여부는 static/_redirects의 /out/<이름> 규칙으로 판단한다(302면 등록, 아니면 404).
// 진행 중 링크에는 자동 meta refresh를 두지 않는다. 링크 미리보기 로봇이 따라가 Awin 클릭이 부풀기 때문이다.
// 끝난 행사는 lib/promo-links.js의 안내 페이지를 보인다. 자동 이동 없이 상시 코드와 카탈로그 버튼만 둔다.
// 자바스크립트가 꺼져 있으면 "이동 중" 문구 대신 버튼을 누르라는 문구와 버튼만 보인다.
import { HTML_HEADERS, STYLE, TEXT, endedPage, endedPromo, notFound, pickLang } from '../../lib/promo-links.js';

export async function onRequest({ request, params, env }) {
  const name = String(params.name || '');
  const origin = new URL(request.url).origin;
  if (!/^[a-z0-9-]+$/.test(name)) return notFound(env, origin);

  // 행사 링크 목록에 있고 종료 시각이 지났으면 제휴 링크로 보내지 않는다.
  const promo = await endedPromo(env, origin, name);
  if (promo) return endedPage(promo, pickLang(request));
  const probe = await env.ASSETS.fetch(new Request(new URL('/out/' + name, origin), { redirect: 'manual' }));
  if (probe.status < 300 || probe.status >= 400) return notFound(env, origin);

  const lang = pickLang(request);
  const t = TEXT[lang];
  const target = '/out/' + name;
  const html = `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${t.doc}</title>
<noscript><style>main .spin, main .js { display: none; } main .nojs { display: block; }</style></noscript>
<style>
${STYLE}
</style>
</head>
<body>
<main>
  <div class="spin" aria-hidden="true"></div>
  <h1 class="js">${t.title}</h1>
  <p class="js">${t.desc}</p>
  <h1 class="nojs">${t.nojsTitle}</h1>
  <p class="nojs">${t.nojsDesc}</p>
  <div class="late">
    <p>${t.late}</p>
    <a class="btn" href="${target}">${t.retry}</a>
  </div>
  <noscript><a class="btn" href="${target}">${t.button}</a></noscript>
</main>
<script>
(function () {
  /* 앞쪽 탭에서는 안내 화면이 한 번 그려진 뒤 넘긴다. 배경 탭은 그 신호가 오지 않으므로 0.3초 뒤에는 그냥 넘긴다. */
  var moved = false;
  function go() { if (!moved) { moved = true; location.replace(${JSON.stringify(target)}); } }
  requestAnimationFrame(function () { setTimeout(go, 30); });
  setTimeout(go, 300);
  setTimeout(function () { document.body.classList.add('is-late'); }, 8000);
})();
</script>
</body>
</html>`;
  return new Response(html, { headers: HTML_HEADERS });
}
