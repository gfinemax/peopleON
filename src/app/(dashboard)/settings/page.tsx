import { requirePageRole, ROLE_GROUPS } from '@/lib/server/authz';
import { SettingsClientPage } from './SettingsClientPage';

export default async function SettingsPage() {
    await requirePageRole(ROLE_GROUPS.financeAdmin);

    return <SettingsClientPage />;
}
