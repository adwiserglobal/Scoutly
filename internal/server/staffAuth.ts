import { appDataRequest, dbValue } from './appData.js';
import { requireFirebaseIdentity } from './firebaseAuth.js';

export type StaffRole = 'admin' | 'support' | 'viewer';

export interface InternalStaff {
  firebase_uid: string;
  email: string | null;
  display_name: string | null;
  role: StaffRole;
  is_active: boolean;
}

function bootstrapEmails() {
  return String(process.env.SCOUTLY_INTERNAL_ADMIN_EMAILS || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export async function requireInternalStaff(req: { headers: any }) {
  const identity = await requireFirebaseIdentity(req);

  const rows = await appDataRequest<InternalStaff[]>(
    `internal_staff?firebase_uid=eq.${dbValue(identity.uid)}&select=firebase_uid,email,display_name,role,is_active&limit=1`
  );

  let staff = rows[0] || null;

  if (!staff && identity.email && bootstrapEmails().includes(identity.email.toLowerCase())) {
    const created = await appDataRequest<InternalStaff[]>('internal_staff?select=firebase_uid,email,display_name,role,is_active', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        firebase_uid: identity.uid,
        email: identity.email,
        display_name: identity.displayName,
        role: 'admin',
        is_active: true,
      }),
    });
    staff = created[0] || null;
  }

  if (!staff || !staff.is_active) {
    throw Object.assign(new Error('Esta conta não possui acesso ao Scoutly Internal.'), {
      statusCode: 403,
    });
  }

  return { identity, staff };
}

export function requireRole(role: StaffRole, allowed: StaffRole[]) {
  if (!allowed.includes(role)) {
    throw Object.assign(new Error('Permissão insuficiente para esta ação.'), {
      statusCode: 403,
    });
  }
}
