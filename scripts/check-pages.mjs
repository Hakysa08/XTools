/** Walks every registered route and reports anything that does not render. */
const BASE = process.env.XTOOLS_BASE ?? "http://localhost:3000";

const slugs = [
  "merge-pdf","split-pdf","remove-pages","extract-pages","organize-pdf","scan-to-pdf",
  "compress-pdf","repair-pdf","ocr-pdf",
  "jpg-to-pdf","word-to-pdf","powerpoint-to-pdf","excel-to-pdf","html-to-pdf",
  "pdf-to-word","pdf-to-powerpoint","pdf-to-excel","pdf-to-jpg","pdf-to-pdfa",
  "edit-pdf","rotate-pdf","add-page-numbers","watermark-pdf","crop-pdf","pdf-forms",
  "sign-pdf","unlock-pdf","protect-pdf","redact-pdf","compare-pdf",
  "summarize-pdf","translate-pdf","pdf-to-markdown",
];
const staticRoutes = ["", "/about", "/privacy", "/terms", "/sitemap.xml", "/robots.txt"];

let failures = 0;

async function check(route, lang) {
  const res = await fetch(BASE + route, { headers: { cookie: `xt_lang=${lang}` } });
  const html = await res.text();
  const ok = res.ok && !/Application error|Internal Server Error|Unhandled Runtime/i.test(html);
  if (!ok) { failures++; console.log(`  FAIL [${lang}] ${route || "/"} -> ${res.status}`); }
  return { ok, html };
}

console.log(`Checking ${staticRoutes.length + slugs.length} routes in 2 languages…\n`);

for (const route of staticRoutes) {
  for (const lang of ["id", "en"]) await check(route, lang);
}

// Confirm the language switch actually changes rendered copy.
const idHome = await check("", "id");
const enHome = await check("", "en");
console.log("i18n: Indonesian home renders 'Alat PDF lengkap' :", idHome.html.includes("Alat PDF lengkap"));
console.log("i18n: English home renders 'Every PDF tool'      :", enHome.html.includes("Every PDF tool"));

for (const slug of slugs) {
  for (const lang of ["id", "en"]) await check(`/${slug}`, lang);
}

// A soon-tool must show the coming-soon panel, not a workspace.
const soon = await check("/summarize-pdf", "id");
console.log("coming-soon panel shown on summarize-pdf         :", soon.html.includes("Segera hadir"));

// 404 handling
const missing = await fetch(BASE + "/tidak-ada-halaman-ini");
console.log("unknown route returns 404                        :", missing.status === 404);

console.log(`\n${failures === 0 ? "ALL ROUTES OK" : failures + " ROUTE FAILURE(S)"}`);
process.exit(failures === 0 ? 0 : 1);
