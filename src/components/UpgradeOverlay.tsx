import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { fetchUserLeads } from '../services/api';
import { getBillingStatus } from '../lib/billing';
import PlansModal from './PlansModal';

export default function UpgradeOverlay() {
  const { user, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const [subscription, setSubscription] = useState<any>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    fetchUserLeads().then((data) => {
      if (!cancelled) setSubscription(data?.subscription || null);
    });
    return () => { cancelled = true; };
  }, [user?.uid]);

  useEffect(() => {
    const show = () => {
      setOpen(true);
      if (user) {
        void fetchUserLeads().then((data) => setSubscription(data?.subscription || null));
      }
    };
    window.addEventListener('scoutly-open-plans', show);
    return () => window.removeEventListener('scoutly-open-plans', show);
  }, [user?.uid]);

  if (!user) return null;
  const billing = getBillingStatus(user, subscription);

  return (
    <PlansModal
      open={open}
      billing={billing}
      forceOpen={false}
      onClose={() => setOpen(false)}
      onSignOut={signOut}
    />
  );
}
