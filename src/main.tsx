import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import './map3dSetup';
import App from './App.tsx';
import { AuthProvider } from './context/AuthContext';
import './index.css';

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
    </AuthProvider>
  </StrictMode>,
);
