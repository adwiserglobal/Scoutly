import type { VercelRequest, VercelResponse } from '@vercel/node';
import { generateContextualSuggestions } from '../../server/aiService.js';
import { appDataRequest, dbValue, ensureAppUser } from '../../server/appDataService.js';
import { requireFirebaseIdentity } from '../../server/firebaseTokenService.js';

const ONBOARDING_VERSION = 1;

async function handleOnboardingAction(req: VercelRequest, res: VercelResponse, action: string) {
  const identity = await requireFirebaseIdentity(req as any);
  await ensureAppUser(identity);

  if (action === 'onboarding-status') {
    const rows = await appDataRequest<any[]>(
      `user_settings?user_uid=eq.${dbValue(identity.uid)}&select=onboarding_version,onboarding_role,onboarding_team_size,onboarding_goal,onboarding_goal_other,onboarding_completed_at,tutorial_completed,tutorial_completed_at&limit=1`
    );
    const settings = rows[0] || null;
    return res.status(200).json({
      onboardingVersion: Number(settings?.onboarding_version || 0),
      tutorialCompleted: Boolean(settings?.tutorial_completed),
      completedAt: settings?.onboarding_completed_at || null,
    });
  }

  if (action === 'save-onboarding') {
    const role = String(req.body?.role || '').trim().slice(0, 80);
    const teamSize = String(req.body?.teamSize || '').trim().slice(0, 40);
    const goal = String(req.body?.goal || '').trim().slice(0, 180);
    const goalOther = String(req.body?.goalOther || '').trim().slice(0, 500);

    if (!role || !teamSize || !goal) {
      return res.status(400).json({ error: 'Preencha as três etapas do onboarding.' });
    }
    if (goal === 'Outro' && !goalOther) {
      return res.status(400).json({ error: 'Conte o que você espera do Scoutly.' });
    }

    await appDataRequest('user_settings?on_conflict=user_uid', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({
        user_uid: identity.uid,
        onboarding_version: ONBOARDING_VERSION,
        onboarding_role: role,
        onboarding_team_size: teamSize,
        onboarding_goal: goal,
        onboarding_goal_other: goal === 'Outro' ? goalOther : null,
        onboarding_completed_at: new Date().toISOString(),
        tutorial_completed: false,
        tutorial_completed_at: null,
        updated_at: new Date().toISOString(),
      }),
    });

    return res.status(200).json({ success: true, onboardingVersion: ONBOARDING_VERSION });
  }

  if (action === 'complete-onboarding-tutorial') {
    await appDataRequest('user_settings?on_conflict=user_uid', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({
        user_uid: identity.uid,
        onboarding_version: ONBOARDING_VERSION,
        tutorial_completed: true,
        tutorial_completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }),
    });
    return res.status(200).json({ success: true });
  }

  return res.status(400).json({ error: 'Ação de onboarding inválida.' });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    const action = String(req.body?.action || '').trim();
    if (action.startsWith('onboarding-') || action === 'save-onboarding' || action === 'complete-onboarding-tutorial') {
      return await handleOnboardingAction(req, res, action);
    }

    const { recentSearches, currentRegionName } = req.body || {};
    const suggestions = await generateContextualSuggestions(
      Array.isArray(recentSearches) ? recentSearches : [],
      currentRegionName || 'São Paulo'
    );
    return res.status(200).json({ suggestions });
  } catch (err: any) {
    console.error('[API /api/ai/suggestions]:', err?.message || err);

    if (String(req.body?.action || '').trim()) {
      const statusCode = Number(err?.statusCode || 500);
      return res.status(statusCode).json({ error: statusCode === 401 ? 'Sessão inválida ou expirada.' : 'Não foi possível salvar o onboarding.' });
    }

    return res.status(500).json({
      suggestions: [
        'Ache restaurantes sem site em São Paulo',
        'Busque clínicas e consultórios em São Paulo',
        'Oficinas mecânicas com WhatsApp em São Paulo',
        'Agências de marketing e B2B em São Paulo',
      ],
      error: err?.message || 'Falha ao gerar sugestões',
    });
  }
}
