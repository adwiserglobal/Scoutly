/**
 * Check what a normal external client can read on the canonical website.
 * Run after a PRODUCTION deployment: npm run seo:live
 * Preview noindex behavior is intentional and is not covered by this probe.
 */
const origin = 'https://www.scoutly.pro';
const paths = ['/', '/robots.txt', '/sitemap.xml', '/llms.txt', '/prospeccao-local/'];
const problems = [];

for (const route of paths) {
  const address = origin + route;
  try {
    const response = await fetch(address, {
      redirect: 'follow',
      headers: { 'User-Agent': 'Scoutly-public-access-check/1.0', Accept: route === '/' ? 'text/html' : '*/*' },
      signal: AbortSignal.timeout(12000)
    });
    const html = await response.text();
    const finalURL = response.url;
    const type = response.headers.get('content-type') || '';
    const robotsHeader = response.headers.get('x-robots-tag') || '';
    console.log(response.status + ' ' + address + ' -> ' + finalURL + ' [' + type + ']');

    if (!response.ok) problems.push(route + ': HTTP ' + response.status + ' (possible deployment protection, DNS or server error)');
    if (new URL(finalURL).hostname !== 'www.scoutly.pro') problems.push(route + ': unexpected redirect to ' + finalURL);
    if (/noindex|nofollow/i.test(robotsHeader)) problems.push(route + ': indexing blocked by X-Robots-Tag: ' + robotsHeader);

    if (route === '/') {
      if (!type.includes('text/html')) problems.push('Homepage did not return HTML');
      if (!html.includes('Scoutly')) problems.push('Homepage has no readable Scoutly content');
      if (/<meta[^>]+name="robots"[^>]+noindex/i.test(html)) problems.push('Homepage is marked noindex, likely a Vercel preview assigned to the public domain');
      if (!html.includes('<h1')) problems.push('Homepage has no crawlable H1 in raw HTML');
      if (!html.includes('https://www.scoutly.pro/')) problems.push('Homepage canonical does not match www destination');
    } else if (route === '/robots.txt') {
      if (/user-agent:\s*\*[\s\S]*?disallow:\s*\/\s*(?:\r?\n|$)/i.test(html)) problems.push('Public robots.txt disallows the whole website');
      if (!html.includes('Sitemap: https://www.scoutly.pro/sitemap.xml')) problems.push('robots.txt sitemap missing');
    } else if (route === '/sitemap.xml') {
      if (!html.includes('<urlset') || !html.includes('https://www.scoutly.pro/prospeccao-local/')) problems.push('Sitemap lacks expected public pages');
    } else if (route === '/llms.txt') {
      if (!html.includes('Scoutly') || !html.includes('www.scoutly.pro')) problems.push('Public AI reference is absent');
    }
  } catch (error) {
    console.error('UNREACHABLE ' + address + ': ' + (error?.message || String(error)));
    problems.push(route + ': unreachable from an external client');
  }
}
if (problems.length) {
  console.error('\n[SEO] Public accessibility problems:\n - ' + problems.join('\n - '));
  process.exitCode = 1;
} else console.log('\n[SEO] Public website, indexation and AI-readable routes are accessible.');
