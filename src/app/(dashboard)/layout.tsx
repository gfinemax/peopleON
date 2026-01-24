import { Sidebar } from '@/components/layout/Sidebar';
import { MobileNav } from '@/components/layout/MobileNav';

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="flex bg-background h-screen w-full overflow-hidden">
            {/* PC Side Navigation - Visible on MD and up */}
            <div className="hidden md:block h-screen sticky top-0 shrink-0">
                <Sidebar />
            </div>


            <div className="flex-1 flex flex-col h-screen relative overflow-hidden">
                {/* Main Content Area */}
                <main className="flex-1 flex flex-col min-h-0 pb-20 md:pb-0 overflow-hidden">
                    {children}
                </main>

                {/* Mobile Bottom Navigation - Visible on small screens only */}
                <MobileNav />
            </div>
        </div>
    );
}
