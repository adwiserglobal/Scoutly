import { appDataRequest, dbValue } from './appDataService.js';

export interface NotificationPrefs {
  businessAlerts: boolean;
  productEmails: boolean;
}

const DEFAULTS: NotificationPrefs = { businessAlerts: true, productEmails: true };

const isMissingColumn = (error: any) => /notify_business_alerts|notify_product_emails|42703|PGRST204/i.test(String(error?.message || ''));

function migrationError(error: any) {
  if (isMissingColumn(error)) {
    return Object.assign(new Error('As preferências de notificação ainda não foram ativadas neste ambiente (falta aplicar a migration 023).'), { statusCode: 503, code: 'NOTIFICATIONS_MIGRATION_PENDING' });
  }
  return error;
}

export async function getNotificationPrefs(userUid: string): Promise<NotificationPrefs> {
  try {
    const rows = await appDataRequest<Array<{ notify_business_alerts?: boolean | null; notify_product_emails?: boolean | null }>>(
      `user_settings?user_uid=eq.${dbValue(userUid)}&select=notify_business_alerts,notify_product_emails&limit=1`,
    );
    return {
      businessAlerts: rows[0]?.notify_business_alerts !== false,
      productEmails: rows[0]?.notify_product_emails !== false,
    };
  } catch (error) {
    throw migrationError(error);
  }
}

/** Used before sending an email: if anything goes wrong we keep the default (send), never lose a notice. */
export async function wantsNotification(userUid: string, kind: keyof NotificationPrefs): Promise<boolean> {
  try {
    return (await getNotificationPrefs(userUid))[kind];
  } catch {
    return DEFAULTS[kind];
  }
}

export async function saveNotificationPrefs(userUid: string, input: Partial<NotificationPrefs>): Promise<NotificationPrefs> {
  const body: Record<string, unknown> = { user_uid: userUid };
  if (typeof input.businessAlerts === 'boolean') body.notify_business_alerts = input.businessAlerts;
  if (typeof input.productEmails === 'boolean') body.notify_product_emails = input.productEmails;
  try {
    await appDataRequest('user_settings?on_conflict=user_uid', {
      method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(body),
    });
  } catch (error) {
    throw migrationError(error);
  }
  return getNotificationPrefs(userUid);
}
