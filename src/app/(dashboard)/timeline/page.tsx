'use client';

import { useState, useRef } from 'react';
import { Header } from '@/components/layout/Header';
import { MaterialIcon } from '@/components/ui/icon';
import { cn } from '@/lib/utils';

interface Activity {
    id: string;
    type: string;
    title: string;
    description: string;
    time: string;
    icon: string;
    iconBg: string;
    iconColor: string;
}

export default function TimelinePage() {
    const [searchQuery, setSearchQuery] = useState('');
    const [activeFilter, setActiveFilter] = useState('all');
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [isWriteMode, setIsWriteMode] = useState(false);
    const [newLogText, setNewLogText] = useState('');
    const [newLogType, setNewLogType] = useState('call');
    const [isTypeDropdownOpen, setIsTypeDropdownOpen] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [attachedFile, setAttachedFile] = useState<File | null>(null);

    // Refs
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    // Voice Input Handler
    const toggleListening = () => {
        if (isListening) {
            setIsListening(false);
            // In a real app, we would stop the recognition here
        } else {
            setIsListening(true);

            // Text to Speech Logic (Browser Support Check)
            if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
                const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
                const recognition = new SpeechRecognition();
                recognition.lang = 'ko-KR';
                recognition.interimResults = false;
                recognition.maxAlternatives = 1;

                recognition.onresult = (event: SpeechRecognitionEvent) => {
                    const transcript = event.results[0][0].transcript;
                    setNewLogText((prev) => prev + (prev ? ' ' : '') + transcript);
                    setIsListening(false);
                };

                recognition.onerror = (event: any) => {
                    console.error('Speech recognition error', event.error);
                    setIsListening(false);
                };

                recognition.onend = () => {
                    setIsListening(false);
                };

                recognition.start();
            } else {
                alert('음성 인식을 지원하지 않는 브라우저입니다.');
                setIsListening(false);
            }
        }
    };

    // Image Input Handler
    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setAttachedFile(file);
        }
    };

    // Sample timeline data
    const activities: Activity[] = [
        {
            id: '1',
            type: 'sms',
            title: '납부 안내 문자 발송',
            description: '미납 회원 24명에게 안내 메시지 발송 완료',
            time: '10분 전',
            icon: 'sms',
            iconBg: 'bg-blue-50 dark:bg-blue-900/30',
            iconColor: 'text-blue-600 dark:text-blue-400',
        },
        {
            id: '2',
            type: 'payment',
            title: '수납 확인: 김철수',
            description: '3차 분담금 15,000,000원 입금 확인',
            time: '1시간 전',
            icon: 'attach_money',
            iconBg: 'bg-green-50 dark:bg-green-900/30',
            iconColor: 'text-green-600 dark:text-green-400',
        },
        {
            id: '3',
            type: 'member',
            title: '신규 회원 등록',
            description: "신규 지주 조합원 '이미자' 등록 완료",
            time: '3시간 전',
            icon: 'person_add',
            iconBg: 'bg-purple-50 dark:bg-purple-900/30',
            iconColor: 'text-purple-600 dark:text-purple-400',
        },
        {
            id: '4',
            type: 'call',
            title: '전화 상담: 홍길동',
            description: '납부 일정 조율 및 분할 납부 협의',
            time: '5시간 전',
            icon: 'phone_in_talk',
            iconBg: 'bg-cyan-50 dark:bg-cyan-900/30',
            iconColor: 'text-cyan-600 dark:text-cyan-400',
        },
        {
            id: '5',
            type: 'document',
            title: '규약 변경 승인',
            description: '관리자 승인 대기중',
            time: '어제',
            icon: 'edit_document',
            iconBg: 'bg-orange-50 dark:bg-orange-900/30',
            iconColor: 'text-orange-600 dark:text-orange-400',
        },
        {
            id: '6',
            type: 'meeting',
            title: '현장 미팅: 박서연',
            description: '인테리어 공사 관련 현장 확인',
            time: '2일 전',
            icon: 'location_on',
            iconBg: 'bg-pink-50 dark:bg-pink-900/30',
            iconColor: 'text-pink-600 dark:text-pink-400',
        },
    ];

    const filterOptions = [
        { label: '전체', value: 'all', icon: 'list' },
        { label: '통화', value: 'call', icon: 'phone' },
        { label: '방문', value: 'meeting', icon: 'location_on' },
        { label: '문자', value: 'sms', icon: 'sms' },
        { label: '수납', value: 'payment', icon: 'payments' },
        { label: '문서', value: 'document', icon: 'description' },
    ];

    // Options for creating a new log (exclude 'all')
    const createOptions = filterOptions.filter(opt => opt.value !== 'all');

    const filteredActivities = activities.filter(activity => {
        const matchesSearch =
            activity.title.includes(searchQuery) ||
            activity.description.includes(searchQuery);
        const matchesFilter = activeFilter === 'all' || activity.type === activeFilter;
        return matchesSearch && matchesFilter;
    });

    return (
        <div className="flex-1 flex flex-col h-full overflow-hidden">
            <Header
                title="활동 타임라인"
                iconName="history"
                leftContent={
                    <div className="flex items-center gap-2">
                        <MaterialIcon name="history" className="text-[19px] text-muted-foreground" />
                        <span className="text-[19px] font-bold tracking-tight text-foreground">활동 타임라인</span>
                    </div>
                }
            />

            <main className="flex-1 overflow-y-auto bg-background">
                <div className="p-4 w-full max-w-md mx-auto flex flex-col gap-4">

                    {/* Write Mode Area (Collapsible) */}
                    {isWriteMode && (
                        <div className="bg-card border border-border rounded-xl p-4 shadow-sm animate-in fade-in slide-in-from-top-2">
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="text-sm font-bold flex items-center gap-2">
                                    <div className="size-6 rounded bg-primary/10 flex items-center justify-center text-primary">
                                        <MaterialIcon name="edit" size="sm" />
                                    </div>
                                    새로운 활동 기록
                                </h3>
                                <button
                                    onClick={() => setIsWriteMode(false)}
                                    className="text-muted-foreground hover:text-foreground"
                                >
                                    <MaterialIcon name="close" size="sm" />
                                </button>
                            </div>
                            <div className="relative">
                                <textarea
                                    className={cn(
                                        "w-full h-24 bg-muted/30 rounded-lg border p-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none mb-3 transition-colors",
                                        isListening ? "border-primary ring-1 ring-primary/50 bg-primary/5" : "border-border"
                                    )}
                                    placeholder={isListening ? "듣고 있습니다..." : "활동 내용을 입력하세요..."}
                                    value={newLogText}
                                    onChange={(e) => setNewLogText(e.target.value)}
                                />
                                {isListening && (
                                    <div className="absolute right-3 top-3 animate-pulse">
                                        <div className="size-2 rounded-full bg-red-500" />
                                    </div>
                                )}
                            </div>

                            {attachedFile && (
                                <div className="flex items-center gap-2 mb-3 p-2 rounded-lg bg-muted/50 border border-border w-fit">
                                    <MaterialIcon name="image" size="sm" className="text-primary" />
                                    <span className="text-xs text-muted-foreground truncate max-w-[200px]">{attachedFile.name}</span>
                                    <button
                                        onClick={() => setAttachedFile(null)}
                                        className="ml-2 hover:text-destructive"
                                    >
                                        <MaterialIcon name="close" size="xs" />
                                    </button>
                                </div>
                            )}
                            <div className="flex items-center justify-between">
                                {/* Left Side: Type Selector */}
                                <div className="relative">
                                    <button
                                        onClick={() => setIsTypeDropdownOpen(!isTypeDropdownOpen)}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted/50 border border-border text-xs font-medium text-foreground hover:bg-muted transition-colors"
                                    >
                                        <MaterialIcon
                                            name={createOptions.find(opt => opt.value === newLogType)?.icon || 'edit'}
                                            size="xs"
                                            className="text-primary"
                                        />
                                        {createOptions.find(opt => opt.value === newLogType)?.label}
                                        <MaterialIcon name="arrow_drop_down" size="xs" className="text-muted-foreground" />
                                    </button>

                                    {/* Type Dropdown */}
                                    {isTypeDropdownOpen && (
                                        <>
                                            <div className="fixed inset-0 z-40" onClick={() => setIsTypeDropdownOpen(false)} />
                                            <div className="absolute left-0 top-full mt-2 w-32 bg-card border border-border rounded-lg shadow-lg z-50 overflow-hidden py-1 animate-in fade-in zoom-in-95 duration-100">
                                                {createOptions.map((option) => (
                                                    <button
                                                        key={option.value}
                                                        onClick={() => {
                                                            setNewLogType(option.value);
                                                            setIsTypeDropdownOpen(false);
                                                        }}
                                                        className={cn(
                                                            "w-full px-3 py-2 text-left text-xs flex items-center gap-2 hover:bg-muted transition-colors",
                                                            newLogType === option.value ? "font-bold text-primary bg-primary/5" : "text-foreground"
                                                        )}
                                                    >
                                                        <MaterialIcon name={option.icon} size="xs" className={newLogType === option.value ? "text-primary" : "text-muted-foreground"} />
                                                        {option.label}
                                                    </button>
                                                ))}
                                            </div>
                                        </>
                                    )}
                                </div>

                                {/* Right Side: Actions */}
                                <div className="flex items-center gap-2">
                                    <input
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        ref={fileInputRef}
                                        onChange={handleImageSelect}
                                    />
                                    <button
                                        onClick={toggleListening}
                                        className={cn(
                                            "p-2 rounded-full transition-all",
                                            isListening ? "bg-red-500/10 text-red-500 animate-pulse" : "hover:bg-muted text-muted-foreground"
                                        )}
                                        title="음성 입력"
                                    >
                                        <MaterialIcon name={isListening ? "mic_off" : "mic"} size="sm" />
                                    </button>
                                    <button
                                        onClick={() => fileInputRef.current?.click()}
                                        className="p-2 rounded-full hover:bg-muted text-muted-foreground transition-colors"
                                        title="사진 첨부"
                                    >
                                        <MaterialIcon name="image" size="sm" />
                                    </button>
                                    <button className="px-4 py-1.5 rounded-lg bg-primary text-white text-xs font-bold hover:bg-primary/90 transition-colors ml-2">
                                        저장
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Search & Actions Row */}
                    <div className="flex items-center gap-2 relative z-20">
                        {/* Search Bar */}
                        <div className="flex-1 relative">
                            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                                <MaterialIcon name="search" size="sm" />
                            </div>
                            <input
                                type="text"
                                placeholder="이름, 동호수, 전화번호 검색"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full h-10 pl-10 pr-4 rounded-lg bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all"
                            />
                        </div>

                        {/* Filter Button & Dropdown */}
                        <div className="relative">
                            <button
                                onClick={() => setIsFilterOpen(!isFilterOpen)}
                                className={cn(
                                    "flex items-center justify-center size-10 rounded-lg border transition-colors",
                                    isFilterOpen || activeFilter !== 'all'
                                        ? "bg-primary/10 border-primary text-primary"
                                        : "bg-card border-border text-muted-foreground hover:text-foreground hover:bg-accent"
                                )}
                            >
                                <MaterialIcon name="tune" size="md" />
                            </button>

                            {/* Dropdown Menu */}
                            {isFilterOpen && (
                                <>
                                    <div className="fixed inset-0 z-10" onClick={() => setIsFilterOpen(false)} />
                                    <div className="absolute right-0 top-full mt-2 w-48 bg-card border border-border rounded-xl shadow-lg z-20 overflow-hidden py-1 animate-in fade-in zoom-in-95 duration-100">
                                        {filterOptions.map((option) => (
                                            <button
                                                key={option.value}
                                                onClick={() => {
                                                    setActiveFilter(option.value);
                                                    setIsFilterOpen(false);
                                                }}
                                                className={cn(
                                                    "w-full px-4 py-2.5 text-left text-sm flex items-center gap-2 hover:bg-muted transition-colors",
                                                    activeFilter === option.value ? "font-bold text-primary bg-primary/5" : "text-foreground"
                                                )}
                                            >
                                                <MaterialIcon name={option.icon} size="sm" className={activeFilter === option.value ? "text-primary" : "text-muted-foreground"} />
                                                {option.label}
                                                {activeFilter === option.value && <MaterialIcon name="check" size="sm" className="ml-auto text-primary" />}
                                            </button>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Write Button */}
                        <button
                            onClick={() => setIsWriteMode(!isWriteMode)}
                            className={cn(
                                "flex items-center justify-center size-10 rounded-lg shadow-md transition-all",
                                isWriteMode ? "bg-muted text-foreground" : "bg-primary text-white hover:bg-primary/90"
                            )}
                        >
                            <MaterialIcon name={isWriteMode ? "close" : "edit"} size="md" />
                        </button>
                    </div>

                    {/* Timeline */}
                    <div className="relative flex flex-col gap-6 pl-2">
                        {/* Vertical Line - Centered (left-5 = 20px, half of size-10) */}
                        <div className="absolute left-5 top-2 bottom-4 w-0.5 bg-border -z-10" />

                        {filteredActivities.length > 0 ? (
                            filteredActivities.map((activity, idx) => (
                                <div key={activity.id} className="relative pl-14 group">
                                    <div className={`absolute left-0 top-0 size-10 rounded-full ${activity.iconBg} border border-border flex items-center justify-center z-10 bg-background`}>
                                        <MaterialIcon name={activity.icon} size="md" className={activity.iconColor} />
                                    </div>

                                    <div className="flex flex-col gap-1 py-1">
                                        <div className="flex justify-between items-start">
                                            <h4 className="text-[15px] font-bold text-foreground leading-none">
                                                {activity.title}
                                            </h4>
                                            <span className="text-[11px] font-bold text-muted-foreground/50 font-mono tracking-tight">
                                                {activity.time}
                                            </span>
                                        </div>
                                        <p className="text-[13px] text-muted-foreground line-clamp-2">
                                            {activity.description}
                                        </p>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-10 text-muted-foreground text-sm">
                                검색 결과가 없습니다.
                            </div>
                        )}
                    </div>

                    {/* Load More */}
                    <div className="border-t border-border p-4">
                        <button className="w-full py-3 text-sm font-medium text-muted-foreground hover:text-primary transition-colors flex items-center justify-center gap-2">
                            <MaterialIcon name="expand_more" size="md" />
                            더 보기
                        </button>
                    </div>
                </div>
            </main>
        </div>
    );
}
