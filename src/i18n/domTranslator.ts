import { EN } from './en';
import { createMatcher } from './matcher';

/**
 * Translates the rendered Portuguese UI into English by swapping DOM text. It never touches
 * React state or props, so Portuguese stays exactly as written in the components and
 * switching languages is just a matter of starting/stopping this observer.
 */

const TRANSLATABLE_ATTRIBUTES = ['placeholder', 'title', 'aria-label', 'alt'];
const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'CODE', 'PRE', 'NOSCRIPT', 'SVG', 'CANVAS']);

const matcher = createMatcher(EN);
const translateText = (value: string) => matcher.translate(value);

/** What each node looked like before we touched it, so we can undo and detect React updates. */
const textState = new WeakMap<Node, { original: string; translated: string }>();
const attrState = new WeakMap<Element, Map<string, { original: string; translated: string }>>();

const isSkipped = (element: Element | null) =>
  !!element && (SKIP_TAGS.has(element.tagName.toUpperCase()) || !!element.closest('[data-no-translate], .notranslate, [contenteditable="true"]'));

function translateTextNode(node: Text) {
  const parent = node.parentElement;
  if (!parent || isSkipped(parent)) return;
  const current = node.nodeValue ?? '';
  const state = textState.get(node);
  if (state && state.translated === current) return; // already ours, unchanged
  const english = translateText(current);
  if (english === null) {
    if (state) textState.delete(node);
    return;
  }
  textState.set(node, { original: current, translated: english });
  node.nodeValue = english;
}

function translateAttributes(element: Element) {
  if (isSkipped(element)) return;
  for (const name of TRANSLATABLE_ATTRIBUTES) {
    const current = element.getAttribute(name);
    if (!current) continue;
    let states = attrState.get(element);
    const state = states?.get(name);
    if (state && state.translated === current) continue;
    const english = translateText(current);
    if (english === null) continue;
    if (!states) attrState.set(element, (states = new Map()));
    states.set(name, { original: current, translated: english });
    element.setAttribute(name, english);
  }
}

function translateTree(root: Node) {
  if (root.nodeType === Node.TEXT_NODE) return translateTextNode(root as Text);
  if (root.nodeType !== Node.ELEMENT_NODE) return;
  const element = root as Element;
  if (isSkipped(element)) return;
  translateAttributes(element);
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    if (node.nodeType === Node.TEXT_NODE) translateTextNode(node as Text);
    else translateAttributes(node as Element);
    node = walker.nextNode();
  }
}

let observer: MutationObserver | null = null;
let originalTitle: string | null = null;

function translateTitle() {
  const english = translateText(document.title);
  if (english !== null) {
    originalTitle = originalTitle ?? document.title;
    document.title = english;
  }
}

export function startDomTranslation() {
  if (observer || typeof document === 'undefined') return;
  translateTree(document.body);
  translateTitle();
  observer = new MutationObserver((mutations) => {
    observer?.disconnect();
    try {
      for (const mutation of mutations) {
        if (mutation.type === 'childList') mutation.addedNodes.forEach(translateTree);
        else if (mutation.type === 'characterData') translateTree(mutation.target);
        else if (mutation.type === 'attributes' && mutation.target.nodeType === Node.ELEMENT_NODE) translateAttributes(mutation.target as Element);
      }
      translateTitle();
    } finally {
      observe();
    }
  });
  observe();
}

function observe() {
  observer?.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: TRANSLATABLE_ATTRIBUTES,
  });
}

export function stopDomTranslation() {
  observer?.disconnect();
  observer = null;
  if (typeof document !== 'undefined' && document.body) {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = textState.get(node);
        if (text && node.nodeValue === text.translated) node.nodeValue = text.original;
      } else {
        const element = node as Element;
        attrState.get(element)?.forEach((state, name) => {
          if (element.getAttribute(name) === state.translated) element.setAttribute(name, state.original);
        });
      }
      node = walker.nextNode();
    }
  }
  if (originalTitle !== null) {
    document.title = originalTitle;
    originalTitle = null;
  }
}
