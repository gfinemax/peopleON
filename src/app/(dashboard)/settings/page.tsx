'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { Header } from '@/components/layout/Header';
import { UnitTypesSection, DepositAccountsSection } from '@/components/features/settings/FinancialSettings';
import {
    SettingsDataSection,
    SettingsNotificationSection,
    SettingsPageIntro,
    SettingsProfileSection,
    SettingsSaveActions,
    SettingsThemeSection,
} from '@/components/features/settings/SettingsPageSections';

export default function SettingsPage() {
    const { theme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);

    // hydration mismatch 방지
    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) {
        return null;
    }

    return (
        <div className="flex-1 flex flex-col h-full overflow-hidden">
            <Header title="설정" iconName="settings" />

            <main className="flex-1 overflow-y-auto bg-background">
                <div className="p-5 lg:p-8 max-w-[800px] mx-auto space-y-5">
                    <SettingsPageIntro />
                    <SettingsProfileSection />
                    <SettingsThemeSection theme={theme} setTheme={setTheme} />
                    <UnitTypesSection />
                    <DepositAccountsSection />
                    <SettingsNotificationSection />
                    <SettingsDataSection />
                    <SettingsSaveActions />
                </div>
            </main>
        </div>
    );
}
