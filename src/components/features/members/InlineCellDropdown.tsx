'use client';

import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import { MaterialIcon } from '@/components/ui/icon';

export interface DropdownOption {
    label: string;
    value: string;
    colorClass?: string;
}

interface InlineCellDropdownProps {
    options: DropdownOption[];
    currentValue: string | string[] | null;
    onSelect: (value: string) => Promise<void>;
    children: React.ReactNode;
    disabled?: boolean;
    multiple?: boolean;
}

export function InlineCellDropdown({
    options,
    currentValue,
    onSelect,
    children,
    disabled = false,
    multiple = false
}: InlineCellDropdownProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const triggerRef = useRef<HTMLDivElement>(null);
    const [coords, setCoords] = useState({ top: 0, left: 0 });

    const openDropdown = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (disabled || isLoading) return;

        if (triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect();

            // Estimate dropdown height: padding (8px) + (options.length * 32px per option)
            const estimatedHeight = 8 + (options.length * 32);

            // Check if there's enough space below. If not, open upwards.
            const spaceBelow = window.innerHeight - rect.bottom;
            const openUpwards = spaceBelow < estimatedHeight + 10;

            setCoords({
                top: openUpwards
                    ? rect.top + window.scrollY - estimatedHeight - 4
                    : rect.bottom + window.scrollY + 4,
                left: rect.left + window.scrollX - 40 // simple offset for better placing
            });
        }
        setIsOpen(true);
    };

    const handleSelect = async (e: React.MouseEvent, value: string) => {
        e.stopPropagation();
        setIsOpen(false);
        setIsLoading(true);
        try {
            await onSelect(value);
        } catch (error: any) {
            console.error(error);
            alert(`업데이트 중 오류가 발생했습니다: ${error.message || '알 수 없는 오류'}`);
        } finally {
            setIsLoading(false);
        }
    };

    // Close on outside click
    useEffect(() => {
        if (!isOpen) return;

        const handleClickOutside = (e: MouseEvent) => {
            // If click inside popover, ignore
            if ((e.target as Element).closest('.inline-cell-dropdown-popover')) return;
            setIsOpen(false);
        };

        window.addEventListener('mousedown', handleClickOutside);
        return () => window.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    const isSelected = (val: string) => {
        if (multiple && Array.isArray(currentValue)) {
            return currentValue.includes(val);
        }
        return currentValue === val;
    };

    return (
        <>
            <div
                ref={triggerRef}
                className={cn(
                    "relative inline-block transition-opacity",
                    disabled ? "opacity-70 cursor-not-allowed" : "cursor-pointer hover:opacity-80"
                )}
                onClick={openDropdown}
            >
                {isLoading ? (
                    <div className="flex items-center gap-1 opacity-50 relative pointer-events-none">
                        {children}
                        <MaterialIcon name="refresh" className="animate-spin absolute -right-4 text-white/50" size="xs" />
                    </div>
                ) : (
                    children
                )}
            </div>

            {isOpen && createPortal(
                <div
                    className="inline-cell-dropdown-popover absolute z-[100] min-w-[120px] bg-[#1E232B] border border-white/10 rounded-lg shadow-xl shadow-black/50 py-1 overflow-hidden"
                    style={{ top: coords.top, left: coords.left }}
                >
                    {options.map((opt) => (
                        <div
                            key={opt.value}
                            onMouseDown={(e) => handleSelect(e, opt.value)}
                            className={cn(
                                "px-3 py-2 text-xs font-semibold flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors",
                                isSelected(opt.value) ? "bg-white/5 text-white" : "text-gray-400",
                                opt.colorClass
                            )}
                        >
                            <span>{opt.label}</span>
                            {isSelected(opt.value) && (
                                <MaterialIcon name="check" size="xs" className="text-emerald-400" />
                            )}
                        </div>
                    ))}
                </div>,
                document.body
            )}
        </>
    );
}
