import { HELP_ARTICLES as RAW_ARTICLES } from './helpArticles.data.mjs';

export interface HelpImage {
  src: string;
  alt: string;
  width: number;
  height: number;
  caption?: string;
}

export interface HelpStep {
  title: string;
  body: string;
  images?: HelpImage[];
}

export interface HelpArticle {
  id: string;
  /** Short title used in the browser tab / search results (<= 60 characters). */
  seoTitle: string;
  /** Meta description (about 120-155 characters). */
  seoDescription: string;
  /** ISO dates (YYYY-MM-DD). */
  published: string;
  updated: string;
  tag: string;
  title: string;
  summary: string;
  readMinutes: number;
  intro: string;
  steps: HelpStep[];
  tips?: string[];
}

export const HELP_ARTICLES: HelpArticle[] = RAW_ARTICLES;

export function getHelpArticle(id: string | null | undefined): HelpArticle | undefined {
  return HELP_ARTICLES.find((article) => article.id === id);
}
