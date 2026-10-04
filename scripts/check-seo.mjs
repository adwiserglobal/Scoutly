import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const dist = path.resolve('dist');
const preview = process.env.VERCEL_ENV === 'preview' || process.env.VERCEL_ENV === 'development';
const pages = [
  '/', '/prospeccao-local/', '/prospeccao-com-ia/', '/para-agencias/',
  '/recursos/', '/dados-e-fontes/', '/perguntas-frequentes/', '/en/'
];
const read = async (file) => readFile(path.join(dist, file), 'utf8');
const failures = [];
function check(condition, message) {
  if (!condition) failures.push(message);
}

for (const route of pages) {
  const file = route === '/' ? 'index.html' : route.slice(1) + 'index.html';
  const html = await read(file);
  check(/<title>[^<]{12,}<\/title>/i.test(html), route + ': missing descriptive title');
  check(/<meta name="description" content="[^"]{50,}"/i.test(html), route + ': missing meta description');
  check(html.includes('https://scoutly.pro' + route), route + ': missing canonical URL');
  check(/<h1[ >]/i.test(html), route + ': missing crawlable H1');
  check(html.includes('application/ld+json'), route + ': missing structured data');
  if (preview) check(/name="robots" content="noindex/i.test(html), route + ': preview must be noindex');
  else check(!/name="robots" content="noindex/i.test(html), route + ': production must be indexable');
  const scripts = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  for (const [, value] of scripts) {
    try {
      const schema = JSON.parse(value);
      check(schema['@context'] === 'https://schema.org', route + ': schema missing context');
    } catch (error) {
      failures.push(route + ': structured data is not valid JSON (' + error.message + ')');
    }
  }
}

const homepage = await read('index.html');
check(homepage.includes('document.documentElement.classList.add("scoutly-js")'),
  'Homepage must hide SEO fallback before the first paint when JS is available.');
check(homepage.includes('html.scoutly-js .seo-fallback{display:none!important}'),
  'SEO fallback display rule missing; users may see the duplicate site flash.');
check(homepage.includes('class="seo-fallback"'),
  'No-JavaScript readable homepage content is missing.');

const sitemap = await read('sitemap.xml');
for (const route of pages) check(sitemap.includes('<loc>https://scoutly.pro' + route + '</loc>'), route + ': not in sitemap');
for (const privatePath of ['/dashboard', '/login', '/api/', '/pipeline']) {
  check(!sitemap.includes('<loc>https://scoutly.pro' + privatePath), privatePath + ': private URL in sitemap');
}
const robots = await read('robots.txt');
if (preview) check(robots.includes('Disallow: /'), 'Preview must block crawlers');
else {
  check(robots.includes('OAI-SearchBot'), 'Missing OAI search crawler rule');
  check(robots.includes('Sitemap: https://scoutly.pro/sitemap.xml'), 'Missing sitemap directive');
}
const llms = await read('llms.txt');
check(llms.includes('https://scoutly.pro/dados-e-fontes/'), 'llms.txt missing methodology reference');
if (failures.length) {
  console.error('[SEO] Validation failed:\n' + failures.map(item => ' - ' + item).join('\n'));
  process.exitCode = 1;
} else console.log('[SEO] Passed: ' + pages.length + ' static pages, canonicals, schemas, robots, sitemap, AI reference and private-route exclusion.');
