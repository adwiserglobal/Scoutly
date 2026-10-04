/**
 * Manual IndexNow submission after a real production deploy.
 *
 * Requires INDEXNOW_KEY in the environment. build-seo.mjs writes the matching
 * key file to the domain root. This notifies participating search engines;
 * it does not guarantee crawling, indexing or rankings.
 */
const key = String(process.env.INDEXNOW_KEY || '').trim();
if (!/^[a-f0-9-]{8,128}$/i.test(key)) {
  console.error('Missing/invalid INDEXNOW_KEY; configure it on the production deployment first.');
  process.exit(1);
}
if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== 'production') {
  console.error('IndexNow submission is disabled outside production.');
  process.exit(1);
}
const host = 'www.scoutly.pro';
const urls = [
  '/', '/prospeccao-local/', '/prospeccao-com-ia/', '/para-agencias/',
  '/recursos/', '/dados-e-fontes/', '/perguntas-frequentes/', '/en/'
].map(route => 'https://' + host + route);
const keyLocation = 'https://' + host + '/' + key + '.txt';
const validation = await fetch(keyLocation, { signal: AbortSignal.timeout(10000) });
if (!validation.ok || (await validation.text()).trim() !== key) {
  console.error('IndexNow key file is not accessible or does not match: ' + keyLocation);
  process.exit(1);
}
const response = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ host, key, keyLocation, urlList: urls }),
  signal: AbortSignal.timeout(15000)
});
if (!response.ok) {
  console.error('IndexNow rejected submission: HTTP ' + response.status);
  process.exit(1);
}
console.log('IndexNow accepted notification for ' + urls.length + ' public URLs (HTTP ' + response.status + '). Indexing is not guaranteed.');
