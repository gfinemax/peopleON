function LoadingCard({ className = '' }: { className?: string }) {
    return <div className={`animate-pulse rounded-2xl border border-white/[0.06] bg-white/[0.03] ${className}`} />;
}

export default function DashboardSectionLoading() {
    return (
        <div className="flex-1 bg-background">
            <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-5 px-4 py-5 lg:px-6">
                <div className="flex items-center justify-between gap-4">
                    <div className="space-y-3">
                        <LoadingCard className="h-9 w-56" />
                        <LoadingCard className="h-4 w-80" />
                    </div>
                    <LoadingCard className="h-10 w-44" />
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <LoadingCard className="h-32" />
                    <LoadingCard className="h-32" />
                    <LoadingCard className="h-32" />
                    <LoadingCard className="h-32" />
                </div>

                <LoadingCard className="h-16" />

                <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr_0.8fr]">
                    <LoadingCard className="min-h-[420px]" />
                    <div className="space-y-4">
                        <LoadingCard className="h-52" />
                        <LoadingCard className="h-40" />
                    </div>
                </div>
            </div>
        </div>
    );
}
