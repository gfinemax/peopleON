'use client';

import { MaterialIcon } from '@/components/ui/icon';
import { cn } from '@/lib/utils';

function SettingsSectionCard({
    title,
    iconName,
    children,
}: {
    title: string;
    iconName: string;
    children: React.ReactNode;
}) {
    return (
        <div className="rounded-lg border border-border bg-card shadow-sm">
            <div className="border-b border-border p-4">
                <h3 className="flex items-center gap-2 text-base font-bold text-foreground">
                    <MaterialIcon name={iconName} size="sm" className="text-muted-foreground" />
                    {title}
                </h3>
            </div>
            <div className="p-4">{children}</div>
        </div>
    );
}

function ThemePreviewCard({
    checked,
    label,
    onClick,
    preview,
}: {
    checked: boolean;
    label: string;
    onClick: () => void;
    preview: React.ReactNode;
}) {
    return (
        <button
            onClick={onClick}
            className={cn(
                'group relative flex flex-col gap-2 text-left transition-all',
                checked ? 'scale-[1.02]' : 'hover:scale-[1.01]',
            )}
        >
            {preview}
            <span className={cn('text-center text-sm font-bold', checked ? 'text-primary' : 'text-muted-foreground')}>
                {label}
            </span>
        </button>
    );
}

export function SettingsPageIntro() {
    return (
        <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">설정</h1>
            <p className="mt-1 text-sm text-muted-foreground">시스템 설정 및 사용자 프로필을 관리합니다.</p>
        </div>
    );
}

export function SettingsProfileSection() {
    return (
        <SettingsSectionCard title="프로필 정보" iconName="person">
            <div className="space-y-3">
                <div className="flex items-center gap-4">
                    <div className="flex size-16 items-center justify-center rounded-full bg-muted">
                        <MaterialIcon name="person" size="xl" className="text-muted-foreground" />
                    </div>
                    <div>
                        <p className="font-bold text-foreground">김관리</p>
                        <p className="text-sm text-muted-foreground">시스템 관리자</p>
                    </div>
                    <button className="ml-auto rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium transition-colors hover:bg-accent">
                        사진 변경
                    </button>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-muted-foreground">이름</label>
                        <input
                            type="text"
                            defaultValue="김관리"
                            className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-muted-foreground">이메일</label>
                        <input
                            type="email"
                            defaultValue="admin@peopleon.co.kr"
                            className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                    </div>
                </div>
            </div>
        </SettingsSectionCard>
    );
}

export function SettingsThemeSection({
    theme,
    setTheme,
}: {
    theme: string | undefined;
    setTheme: (theme: string) => void;
}) {
    return (
        <SettingsSectionCard title="테마 설정" iconName="palette">
            <div className="grid grid-cols-3 gap-4">
                <ThemePreviewCard
                    checked={theme === 'light'}
                    label="라이트 모드"
                    onClick={() => setTheme('light')}
                    preview={
                        <div
                            className={cn(
                                'relative aspect-[4/3] overflow-hidden rounded-lg border-2 bg-[#F8FAFC] p-2 transition-all',
                                theme === 'light'
                                    ? 'border-primary ring-2 ring-primary/20'
                                    : 'border-border group-hover:border-primary/50',
                            )}
                        >
                            <div className="h-full w-full space-y-1.5 opacity-80">
                                <div className="h-3 w-full rounded border border-slate-200 bg-white" />
                                <div className="flex h-full gap-1.5">
                                    <div className="h-full w-4 rounded border border-slate-200 bg-white" />
                                    <div className="flex-1 space-y-1.5">
                                        <div className="h-12 w-full rounded border border-slate-200 bg-white shadow-sm" />
                                        <div className="h-4 w-2/3 rounded bg-slate-100" />
                                    </div>
                                </div>
                            </div>
                            {theme === 'light' && (
                                <div className="absolute right-2 top-2 flex size-5 items-center justify-center rounded-full bg-primary text-white shadow-lg">
                                    <MaterialIcon name="check" size="xs" />
                                </div>
                            )}
                        </div>
                    }
                />

                <ThemePreviewCard
                    checked={theme === 'dark'}
                    label="다크 모드"
                    onClick={() => setTheme('dark')}
                    preview={
                        <div
                            className={cn(
                                'relative aspect-[4/3] overflow-hidden rounded-lg border-2 bg-[#0F172A] p-2 transition-all',
                                theme === 'dark'
                                    ? 'border-primary ring-2 ring-primary/20'
                                    : 'border-border group-hover:border-primary/50',
                            )}
                        >
                            <div className="h-full w-full space-y-1.5 opacity-80">
                                <div className="h-3 w-full rounded border border-slate-800 bg-[#1e293b]" />
                                <div className="flex h-full gap-1.5">
                                    <div className="h-full w-4 rounded border border-slate-800 bg-[#1e293b]" />
                                    <div className="flex-1 space-y-1.5">
                                        <div className="h-12 w-full rounded border border-slate-800 bg-[#1e293b] shadow-sm" />
                                        <div className="h-4 w-2/3 rounded bg-slate-800" />
                                    </div>
                                </div>
                            </div>
                            {theme === 'dark' && (
                                <div className="absolute right-2 top-2 flex size-5 items-center justify-center rounded-full bg-primary text-white shadow-lg">
                                    <MaterialIcon name="check" size="xs" />
                                </div>
                            )}
                        </div>
                    }
                />

                <ThemePreviewCard
                    checked={theme === 'system'}
                    label="시스템 설정"
                    onClick={() => setTheme('system')}
                    preview={
                        <div
                            className={cn(
                                'relative aspect-[4/3] overflow-hidden rounded-lg border-2 bg-slate-100 transition-all',
                                theme === 'system'
                                    ? 'border-primary ring-2 ring-primary/20'
                                    : 'border-border group-hover:border-primary/50',
                            )}
                        >
                            <div className="absolute inset-0 flex">
                                <div className="flex flex-1 flex-col gap-1.5 bg-[#F8FAFC] p-2">
                                    <div className="h-3 w-full rounded border border-slate-200 bg-white" />
                                    <div className="h-12 w-full rounded border border-slate-200 bg-white" />
                                </div>
                                <div className="flex flex-1 flex-col gap-1.5 bg-[#0F172A] p-2">
                                    <div className="h-3 w-full rounded border border-slate-800 bg-[#1e293b]" />
                                    <div className="h-12 w-full rounded border border-slate-800 bg-[#1e293b]" />
                                </div>
                            </div>
                            {theme === 'system' && (
                                <div className="absolute right-2 top-2 z-10 flex size-5 items-center justify-center rounded-full bg-primary text-white shadow-lg">
                                    <MaterialIcon name="check" size="xs" />
                                </div>
                            )}
                        </div>
                    }
                />
            </div>
        </SettingsSectionCard>
    );
}

export function SettingsNotificationSection() {
    return (
        <SettingsSectionCard title="알림 설정" iconName="notifications">
            <div className="space-y-3">
                {[
                    { label: '이메일 알림', desc: '중요 업데이트 이메일 수신' },
                    { label: '미납 알림', desc: '미납 발생 시 즉시 알림' },
                    { label: '신규 가입 알림', desc: '신규 조합원 가입 시 알림' },
                ].map((item) => (
                    <div
                        key={item.label}
                        className="flex items-center justify-between border-b border-border py-2 last:border-0"
                    >
                        <div>
                            <p className="font-medium text-foreground">{item.label}</p>
                            <p className="text-sm text-muted-foreground">{item.desc}</p>
                        </div>
                        <button className="relative h-6 w-11 rounded-full bg-muted transition-colors">
                            <span className="absolute left-1 top-1 size-4 rounded-full bg-muted-foreground transition-transform" />
                        </button>
                    </div>
                ))}
            </div>
        </SettingsSectionCard>
    );
}

export function SettingsDataSection() {
    return (
        <SettingsSectionCard title="데이터 관리" iconName="database">
            <div className="space-y-3">
                <button className="flex w-full items-center gap-3 rounded-lg border border-border p-3 text-left transition-colors hover:bg-accent">
                    <MaterialIcon name="download" size="md" className="text-muted-foreground" />
                    <div>
                        <p className="font-medium text-foreground">데이터 내보내기</p>
                        <p className="text-sm text-muted-foreground">전체 데이터를 엑셀로 다운로드</p>
                    </div>
                </button>
                <button className="flex w-full items-center gap-3 rounded-lg border border-border p-3 text-left transition-colors hover:bg-accent">
                    <MaterialIcon name="upload" size="md" className="text-muted-foreground" />
                    <div>
                        <p className="font-medium text-foreground">데이터 가져오기</p>
                        <p className="text-sm text-muted-foreground">엑셀 파일에서 데이터 일괄 등록</p>
                    </div>
                </button>
            </div>
        </SettingsSectionCard>
    );
}

export function SettingsSaveActions() {
    return (
        <div className="flex justify-end">
            <button className="rounded-lg bg-primary px-6 py-2.5 font-bold text-white shadow-md transition-colors hover:bg-[#0f6bd0]">
                변경사항 저장
            </button>
        </div>
    );
}
