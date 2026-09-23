import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { AuthProvider } from './context/AuthContext';
import MarketingMediaEnhancer from './components/MarketingMediaEnhancer';
import OnboardingGate from './components/OnboardingGate';
import './index.css';
import './marketing-overrides.css';

const promoCode = new URLSearchParams(window.location.search)
  .get('promo')
  ?.trim()
  .toLowerCase();

if (promoCode === 'scoutlypro10') {
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `scoutly_promo_code=${encodeURIComponent(promoCode)}; Path=/; Max-Age=2592000; SameSite=Lax${secure}`;
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
