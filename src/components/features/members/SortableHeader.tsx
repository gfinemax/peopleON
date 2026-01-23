'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SortableHeaderProps {
    label: string;
    field: string;
    className?: string;
}

export function SortableHeader({ label, field, className }: SortableHeaderProps) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const currentSort = searchParams.get('sort');
    const currentOrder = searchParams.get('order');

    const isSorted = currentSort === field;

    const handleSort = () => {
        const params = new URLSearchParams(searchParams.toString());

        if (isSorted) {
            // Toggle order
            params.set('order', currentOrder === 'asc' ? 'desc' : 'asc');
        } else {
            // New sort field
            params.set('sort', field);
            params.set('order', 'asc');
        }

        router.push(`${pathname}?${params.toString()}`, { scroll: false });
    };

    return (
        <div
            className={cn(
                "flex items-center gap-1 cursor-pointer hover:text-blue-600 transition-colors group select-none",
                isSorted && "text-blue-700 font-bold",
                className
            )}
            onClick={handleSort}
        >
            {label}
            <span className="shrink-0">
                {!isSorted ? (
                    <ArrowUpDown className="w-3 h-3 text-slate-300 group-hover:text-blue-400" />
                ) : currentOrder === 'asc' ? (
                    <ArrowUp className="w-3 h-3" />
                ) : (
                    <ArrowDown className="w-3 h-3" />
                )}
            </span>
        </div>
    );
}
