/** Matches Portuguese strings against a dictionary of exact texts and {0}-style templates. */

interface Template {
  pattern: RegExp;
  caseless: RegExp;
  english: string;
  weight: number;
}

export interface Matcher {
  /** Returns the English text, or null when the input is unknown. Keeps surrounding whitespace. */
  translate: (value: string) => string | null;
}

const MIN_TEMPLATE_LITERAL = 6; // keeps patterns like "{0} em {1}" from rewriting user content
const collapse = (value: string) => value.replace(/\s+/g, ' ').trim();
const escapeRegex = (part: string) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const dotDecimals = (value: string) => value.replace(/(\d),(\d)/g, '$1.$2');

export function createMatcher(dictionary: Record<string, string>): Matcher {
  const exact = new Map<string, string>();
  const lowerExact = new Map<string, string>();
  const templates: Template[] = [];

  for (const [portuguese, english] of Object.entries(dictionary)) {
    if (/\{\d+\}/.test(portuguese)) {
      const literal = portuguese.replace(/\{\d+\}/g, '');
      if (literal.length < MIN_TEMPLATE_LITERAL) continue;
      const source = portuguese.split(/\{\d+\}/).map(escapeRegex).join('(.+?)');
      templates.push({
        pattern: new RegExp(`^${source}$`),
        caseless: new RegExp(`^${source}$`, 'i'),
        english,
        weight: literal.length,
      });
    } else {
      exact.set(portuguese, english);
      lowerExact.set(portuguese.toLowerCase(), english);
    }
  }
  // Most specific (longest literal) patterns first.
  templates.sort((a, b) => b.weight - a.weight);

  const fillTemplate = (template: Template, match: RegExpExecArray, caseless: boolean) =>
    template.english.replace(/\{(\d+)\}/g, (_, index) => {
      const captured = match[Number(index) + 1] ?? '';
      return (caseless ? lowerExact.get(captured.toLowerCase()) : exact.get(captured)) ?? dotDecimals(captured);
    });

  const lookup = (core: string, caseless: boolean): string | undefined => {
    const direct = caseless ? lowerExact.get(core.toLowerCase()) : exact.get(core);
    if (direct !== undefined) return direct;
    for (const template of templates) {
      const match = (caseless ? template.caseless : template.pattern).exec(core);
      if (match) return fillTemplate(template, match, caseless);
    }
    return undefined;
  };

  return {
    translate(value: string) {
      const core = collapse(value);
      if (!core) return null;
      let english = lookup(core, false);
      // ALL CAPS labels (drawn with toUpperCase) are matched ignoring case and restored to caps.
      if (english === undefined && core === core.toUpperCase() && /[A-ZÀ-Ý]{2}/.test(core)) {
        const caps = lookup(core, true);
        if (caps !== undefined) english = caps.toUpperCase();
      }
      if (english === undefined || english === core) return null;
      const leading = value.match(/^\s*/)?.[0] ?? '';
      const trailing = value.match(/\s*$/)?.[0] ?? '';
      return leading + english + trailing;
    },
  };
}
