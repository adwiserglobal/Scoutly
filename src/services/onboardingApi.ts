import { auth } from '../lib/firebase';
import type { OnboardingAnswers } from '../components/OnboardingExperience';

const ENDPOINT = '/api/ai/suggestions';

async function onboardingRequest(body: Record<string, unknown>) {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('Usuário não autenticado');

  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error || 'Não foi possível concluir o onboarding.');
  return data;
}

export async function fetchOnboardingStatus(): Promise<{
  onboardingVersion: number;
  tutorialCompleted: boolean;
  completedAt?: string | null;
  subscription?: {
    plan: string;
    status: string;
    currentPeriodStart?: string | null;
    currentPeriodEnd?: string | null;
  } | null;
}> {
  return onboardingRequest({ action: 'onboarding-status' });
}

export async function saveOnboardingAnswers(answers: OnboardingAnswers) {
  return onboardingRequest({ action: 'save-onboarding', ...answers });
}

export async function startOnboardingTrial() {
  return onboardingRequest({ action: 'start-trial' });
}

export async function completeOnboardingTutorial() {
  return onboardingRequest({ action: 'complete-onboarding-tutorial' });
}
