'use client';

import { useState, useEffect, ReactNode, createContext, useContext } from 'react';
import { cn } from '@/lib/utils';
import { MembersFilter } from './MembersFilter';

interface DashboardContextType {
    isCollapsed: boolean;
    setIsCollapsed: (val: boolean) => void;
}

const DashboardContext = createContext<DashboardContextType | undefined>(undefined);

export function useDashboard() {
    const context = useContext(DashboardContext);
    if (!context) throw new Error('useDashboard must be used within DashboardManager');
    return context;
}

interface DashboardManagerProps {
    kpiSection: ReactNode;
    qualitySection: ReactNode;
    filterData: {
        roleCounts: Record<string, number>;
        tierCounts: Record<string, number>;
        statusCounts: Record<string, number>;
        relCounts: Record<string, number>;
        relationNames: string[];
        absoluteTotalCount: number;
        filteredCount: number;
    };
    children?: ReactNode;
}

export function DashboardManager({
    kpiSection,
    qualitySection,
    filterData,
    children,
}: DashboardManagerProps) {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isAutoCollapsed, setIsAutoCollapsed] = useState(false);

    // Scroll-based auto collapse
    useEffect(() => {
        const handleScroll = () => {
            const scrollPos = window.scrollY;
            if (scrollPos > 150) {
                if (!isAutoCollapsed) setIsAutoCollapsed(true);
            } else {
                if (isAutoCollapsed) setIsAutoCollapsed(false);
            }
        };

        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, [isAutoCollapsed]);

    // Effective collapse state (either manual or auto)
    const effectiveCollapsed = isCollapsed || isAutoCollapsed;

    return (
        <DashboardContext.Provider value={{ isCollapsed: effectiveCollapsed, setIsCollapsed }}>
            <div className="flex flex-col gap-2 w-full max-w-[1600px] mx-auto">
                {/* Dashboard Area (KPI + Quality) */}
                <div
                    className={cn(
                        "transition-all duration-500 ease-in-out origin-top overflow-hidden",
                        effectiveCollapsed ? "max-h-0 opacity-0 scale-y-95 pointer-events-none mb-0" : "max-h-[500px] opacity-100 scale-y-100 mb-2"
                    )}
                >
                    <div className="flex flex-col gap-2">
                        {kpiSection}
                        {qualitySection}
                    </div>
                </div>

                {/* Filter Area (Always visible, but toggle is inside) */}
                <div className={cn(
                    "sticky top-[64px] z-30 bg-background/80 backdrop-blur-sm pb-2 transition-all",
                    effectiveCollapsed && "shadow-lg pt-1"
                )}>
                    <MembersFilter
                        {...filterData}
                        isDashboardCollapsed={effectiveCollapsed}
                        onToggleDashboard={() => setIsCollapsed(!isCollapsed)}
                    />
                </div>

                {/* Content Area */}
                {children}
            </div>
        </DashboardContext.Provider>
    );
}
