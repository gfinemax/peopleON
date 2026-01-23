import { Sidebar } from '@/components/layout/Sidebar';
import { BottomNav } from '@/components/layout/BottomNav';

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="flex bg-background min-h-screen w-full">
            {/* PC Side Navigation - Visible on MD and up */}
            <div className="hidden md:block h-screen sticky top-0">
                <Sidebar />
            </div>


            <div className="flex-1 flex flex-col min-h-screen relative overflow-x-hidden">
                {/* Main Content Area */}
                <main className="flex-1 pb-20 md:pb-0">
                    {children}
                </main>

                {/* Mobile Bottom Navigation - Visible on small screens only */}
                <BottomNav />
            </div>
        </div>
    );
}
