import { generateText } from './llmChain.js';

/** Replies are written in Portuguese; users browsing in English get a faithful translation. */
export async function translateReplyToEnglish(text: string): Promise<string> {
  if (!text || text.length < 3) return text;
  try {
    const result = await generateText({
      messages: [
        {
          role: 'system',
          content:
            'Translate the user message from Brazilian Portuguese to natural English. Keep the markdown (**bold**, lists, line breaks), numbers, business names, places, URLs and quoted outreach drafts exactly as they are in structure. Output only the translation, with no preface or notes.',
        },
        { role: 'user', content: text },
      ],
      temperature: 0,
      maxTokens: 900,
      budgetMs: 9_000,
      title: 'Scoutly AI translation',
    });
    return result.text?.trim() || text;
  } catch (error: any) {
    console.warn('[Scoutly AI] reply translation skipped:', error?.message || error);
    return text;
  }
}

/** The search interpreter understands Portuguese; English requests are translated first. */
export async function translateRequestToPortuguese(text: string): Promise<string> {
  if (!text || text.length < 3) return text;
  try {
    const result = await generateText({
      messages: [
        {
          role: 'system',
          content:
            'Translate the user message to Brazilian Portuguese as a business-prospecting request, using natural phrasing such as "sem site", "com telefone", "em <cidade>". Keep place names, numbers and business names unchanged. If it is already Portuguese, return it unchanged. Output only the final text.',
        },
        { role: 'user', content: text },
      ],
      temperature: 0,
      maxTokens: 300,
      budgetMs: 6_000,
      title: 'Scoutly AI request translation',
    });
    return result.text?.trim() || text;
  } catch (error: any) {
    console.warn('[Scoutly AI] request translation skipped:', error?.message || error);
    return text;
  }
}
