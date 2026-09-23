import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { AuthProvider } from './context/AuthContext';
import MarketingMediaEnhancer from './components/MarketingMediaEnhancer';
import OnboardingGate from './components/OnboardingGate';
import './index.css';
import './marketing-overrides.css';

const SHAREABLE_PROMOTION_CODE = 'scoutlypro10';
const promoFromUrl = new URLSearchParams(window.location.search)
  .get('promo')
  ?.trim()
  .toLowerCase();

if (promoFromUrl === SHAREABLE_PROMOTION_CODE) {
  localStorage.setItem('scoutly_promo_code', SHAREABLE_PROMOTION_CODE);
}

const storedPromoCode = localStorage.getItem('scoutly_promo_code')?.trim().toLowerCase();
if (storedPromoCode === SHAREABLE_PROMOTION_CODE) {
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  const hostname = window.location.hostname.toLowerCase();
  const sharedDomain =
    hostname === 'scoutly.pro' || hostname.endsWith('.scoutly.pro')
      ? '; Domain=.scoutly.pro'
      : '';

  document.cookie = `scoutly_promo_code=${encodeURIComponent(SHAREABLE_PROMOTION_CODE)}; Path=/; Max-Age=2592000; SameSite=Lax${sharedDomain}${secure}`;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <App />
      <MarketingMediaEnhancer />
      <OnboardingGate />
    </AuthProvider>
  </StrictMode>,
);
