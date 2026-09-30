/**
 * Normalizes domain-only external links (for example `www.example.com`) before
 * the browser resolves them as a relative Scoutly URL (`scoutly.pro/www.example.com`).
 *
 * The guard mutates anchors in the DOM so every existing and future "Ver site"
 * entry point benefits from the same behavior without duplicating URL logic.
 */
export function normalizeExternalHref(value: string): string {
  const raw = String(value || '').trim();
  if (!raw) return raw;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (/^\/\//.test(raw)) return `https:${raw}`;
  return `https://${raw.replace(/^\/+/, '')}`;
}

function looksLikeBareExternalDomain(value: string): boolean {
  const raw = String(value || '').trim();
  if (!raw) return false;
  if (/^(?:https?:|mailto:|tel:|sms:|javascript:|data:|blob:|#|\/)/i.test(raw)) return false;

  const host = raw.split('/')[0].split('?')[0].split('#')[0];
  return /^www\./i.test(host) || /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+(?::\d+)?$/i.test(host);
}

function normalizeAnchor(anchor: HTMLAnchorElement) {
  const raw = anchor.getAttribute('href');
  if (!raw || !looksLikeBareExternalDomain(raw)) return;
  anchor.setAttribute('href', normalizeExternalHref(raw));
}

function normalizeTree(root: ParentNode) {
  if (root instanceof HTMLAnchorElement) normalizeAnchor(root);
  root.querySelectorAll?.('a[href]').forEach((element) => normalizeAnchor(element as HTMLAnchorElement));
}

export function installExternalLinkGuard() {
  if (typeof document === 'undefined') return;

  const start = () => {
    normalizeTree(document);

    const observer = new MutationObserver((records) => {
      for (const record of records) {
        if (record.type === 'attributes' && record.target instanceof HTMLAnchorElement) {
          normalizeAnchor(record.target);
        }
        record.addedNodes.forEach((node) => {
          if (node instanceof Element) normalizeTree(node);
        });
      }
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['href'],
    });
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
}
