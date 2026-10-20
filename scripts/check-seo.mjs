import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { HELP_ARTICLES } from '../src/data/helpArticles.data.mjs';
import { BLOG_ARTICLES } from '../src/data/blogArticles.data.mjs';

const dist = path.resolve('dist');
const preview = process.env.VERCEL_ENV === 'preview' || process.env.VERCEL_ENV === 'development';
const pages = [
  '/', '/prospeccao-local/', '/prospeccao-com-ia/', '/para-agencias/',
  '/recursos/', '/dados-e-fontes/', '/perguntas-frequentes/', '/en/',
  '/ajuda/', ...HELP_ARTICLES.map((article) => '/ajuda/' + article.id + '/'),
  '/blog/', ...BLOG_ARTICLES.map((article) => '/blog/' + article.id + '/')
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
for (const article of BLOG_ARTICLES) {
  const route = '/blog/' + article.id + '/';
  const html = await read(route.slice(1) + 'index.html');
  const title = (html.match(/<title>([^<]*)<\/title>/i) || [])[1] || '';
  check(title.length >= 20 && title.length <= 65, route + ': title should be 20-65 chars, got ' + title.length);
  check(!titles.has(title), route + ': duplicate title with ' + titles.get(title));
  titles.set(title, route);
  const description = (html.match(/<meta name="description" content="([^"]*)"/i) || [])[1] || '';
  check(description.length >= 100 && description.length <= 160, route + ': meta description should be 100-160 chars, got ' + description.length);
  check(html.includes('"@type":"Article"') && html.includes('"@type":"FAQPage"') && html.includes('"@type":"BreadcrumbList"'), route + ': missing Article/FAQ/Breadcrumb schema');
  check(/Atualizado em /.test(html) && html.includes('Resumo rápido') && html.includes('Fontes e referências'), route + ': missing date, TL;DR or sources');
  const ids = new Set([...html.matchAll(/<section id="([^"]+)"/g)].map((m) => m[1]));
  for (const [, anchor] of html.matchAll(/href="#([^"]+)"/g)) check(ids.has(anchor), route + ': broken anchor #' + anchor);
  const internal = [...html.matchAll(/href="(\/[^"#]*)"/g)].map((m) => m[1]);
  check(internal.filter((l) => l.startsWith('/blog/') && l !== route && l !== '/blog/').length >= 2, route + ': needs at least 2 links to other articles');
  check(internal.some((l) => l.startsWith('/ajuda/') || l.startsWith('/prospeccao') || l === '/recursos/'), route + ': needs product/help links');
  const words = html.replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>|<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
  check(words >= 1000, route + ': thin content (' + words + ' words)');
}
const blogIndex = await read('blog/index.html');
for (const article of BLOG_ARTICLES) check(blogIndex.includes('href="/blog/' + article.id + '/"'), 'Blog index does not link to ' + article.id);
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
