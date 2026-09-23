import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { AuthProvider } from './context/AuthContext';
import MarketingMediaEnhancer from './components/MarketingMediaEnhancer';
import OnboardingGate from './components/OnboardingGate';
import './index.css';
import './marketing-overrides.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <App />
      <MarketingMediaEnhancer />
      <OnboardingGate />
    </AuthProvider>
  </StrictMode>,
);
