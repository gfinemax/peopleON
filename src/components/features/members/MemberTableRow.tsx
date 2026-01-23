'use client';

import { useRouter } from 'next/navigation';
import { TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

interface MemberTableRowProps {
    memberId: string;
    children: React.ReactNode;
    className?: string;
}

export function MemberTableRow({ memberId, children, className }: MemberTableRowProps) {
    const router = useRouter();

    return (
        <TableRow
            className={cn("cursor-pointer hover:bg-slate-100/50 transition-colors", className)}
            onClick={() => router.push(`/members/${memberId}`)}
        >
            {children}
        </TableRow>
    );
}
