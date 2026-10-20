import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { HELP_ARTICLES } from '../src/data/helpArticles.data.mjs';

const dist = path.resolve('dist');
const preview = process.env.VERCEL_ENV === 'preview' || process.env.VERCEL_ENV === 'development';
const pages = [
  '/', '/prospeccao-local/', '/prospeccao-com-ia/', '/para-agencias/',
  '/recursos/', '/dados-e-fontes/', '/perguntas-frequentes/', '/en/',
  '/ajuda/', ...HELP_ARTICLES.map((article) => '/ajuda/' + article.id + '/')
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
  check(html.includes('https://www.scoutly.pro' + route), route + ': missing canonical URL');
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

const titles = new Map();
for (const article of HELP_ARTICLES) {
  const route = '/ajuda/' + article.id + '/';
  const html = await read(route.slice(1) + 'index.html');
  const title = (html.match(/<title>([^<]*)<\/title>/i) || [])[1] || '';
  check(title.length >= 20 && title.length <= 65, route + ': title should be 20-65 chars, got ' + title.length);
  check(!titles.has(title), route + ': duplicate title with ' + titles.get(title));
  titles.set(title, route);
  const description = (html.match(/<meta name="description" content="([^"]*)"/i) || [])[1] || '';
  check(description.length >= 100 && description.length <= 160, route + ': meta description should be 100-160 chars, got ' + description.length);
  check(html.includes('"@type":"TechArticle"'), route + ': missing TechArticle schema');
  check(html.includes('"@type":"BreadcrumbList"'), route + ': missing breadcrumb schema');
  check(/Atualizado em /.test(html), route + ': missing visible update date');
  for (const [, tag] of html.matchAll(/<figure class="help-fig"><img\b([^>]*)>/g)) {
    check(/\balt="[^"]{8,}"/.test(tag), route + ': image without a descriptive alt text');
    check(/\bwidth="\d+"/.test(tag) && /\bheight="\d+"/.test(tag), route + ': image without width/height (layout shift)');
  }
  const links = [...html.matchAll(/href="(\/ajuda\/[^"]*)"/g)].map((match) => match[1]);
  check(links.includes('/ajuda/'), route + ': missing link back to the help center index');
  check(links.some((link) => link !== route && link !== '/ajuda/'), route + ': missing links to related articles');
}
const helpIndex = await read('ajuda/index.html');
for (const article of HELP_ARTICLES) check(helpIndex.includes('href="/ajuda/' + article.id + '/"'), 'Help index does not link to ' + article.id);
const homeLinks = await read('index.html');
check(homeLinks.includes('href="/ajuda/"'), 'Homepage fallback must link to the help center');

const homepage = await read('index.html');
check(homepage.includes('document.documentElement.classList.add("scoutly-js")'),
  'Homepage must hide SEO fallback before the first paint when JS is available.');
check(/html\.scoutly-js \.seo-fallback[^{]*\{display:none!important\}/.test(homepage),
  'SEO fallback display rule missing; users may see the duplicate site flash.');
check(homepage.includes('class="seo-fallback"'),
  'No-JavaScript readable homepage content is missing.');

const sitemap = await read('sitemap.xml');
for (const route of pages) check(sitemap.includes('<loc>https://www.scoutly.pro' + route + '</loc>'), route + ': not in sitemap');
for (const privatePath of ['/dashboard', '/login', '/api/', '/pipeline']) {
  check(!sitemap.includes('<loc>https://www.scoutly.pro' + privatePath), privatePath + ': private URL in sitemap');
}
const robots = await read('robots.txt');
if (preview) check(robots.includes('Disallow: /'), 'Preview must block crawlers');
else {
  check(robots.includes('OAI-SearchBot'), 'Missing OAI search crawler rule');
  check(robots.includes('Sitemap: https://www.scoutly.pro/sitemap.xml'), 'Missing sitemap directive');
}
const llms = await read('llms.txt');
check(llms.includes('https://www.scoutly.pro/dados-e-fontes/'), 'llms.txt missing methodology reference');
if (failures.length) {
  console.error('[SEO] Validation failed:\n' + failures.map(item => ' - ' + item).join('\n'));
  process.exitCode = 1;
} else console.log('[SEO] Passed: ' + pages.length + ' static pages, canonicals, schemas, robots, sitemap, AI reference and private-route exclusion.');
