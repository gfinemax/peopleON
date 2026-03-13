'use client';

import { useState } from 'react';
import { DuplicateGroup, mergeDuplicateEntities, ignoreDuplicateGroups } from '@/app/actions/duplicates';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, Key, Check } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';


export default function DuplicatesManager({ initialGroups }: { initialGroups: DuplicateGroup[] }) {
    const [groups, setGroups] = useState<DuplicateGroup[]>(initialGroups);
    const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());

    if (groups.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-center border rounded-lg bg-card/50 shadow-sm border-dashed">
                <CheckCircle2 className="w-16 h-16 text-emerald-500 mb-4 opacity-80" />
                <h3 className="text-2xl font-bold tracking-tight mb-2">중복 의심 인물이 없습니다!</h3>
                <p className="text-muted-foreground max-w-md">
                    현재 시스템 상에 연락처가 동일한 중복 인물(병합 누락건)이 발견되지 않았습니다.
                </p>
            </div>
        );
    }

    const removeGroupFromView = (phone: string) => {
        setGroups(prev => prev.filter(g => g.phone !== phone));
    };

    const handleMerge = async (phone: string, masterId: string, slaveIds: string[]) => {
        setLoadingIds(prev => new Set(prev).add(phone));
        try {
            const res = await mergeDuplicateEntities(masterId, slaveIds);
            if (res.error) {
                alert(res.error);
            } else {
                alert(res.message);
                removeGroupFromView(phone);
            }
        } catch (e) {
            alert('병합 중 오류가 발생했습니다.');
        } finally {
            setLoadingIds(prev => {
                const next = new Set(prev);
                next.delete(phone);
                return next;
            });
        }
    };

    const handleIgnore = async (phone: string, entityIds: string[]) => {
        setLoadingIds(prev => new Set(prev).add(phone));
        try {
            const res = await ignoreDuplicateGroups(entityIds);
            if (res.error) {
                alert(res.error);
            } else {
                alert(res.message || '병합 제외 처리되었습니다.');
                removeGroupFromView(phone);
            }
        } catch (e) {
            alert('제외 처리 중 오류가 발생했습니다.');
        } finally {
            setLoadingIds(prev => {
                const next = new Set(prev);
                next.delete(phone);
                return next;
            });
        }
    };

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-end">
                <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="px-3 py-1 text-sm bg-blue-500/10 text-blue-600 dark:text-blue-400">
                        총 {groups.length}개 그룹 발견
                    </Badge>
                </div>
            </div>

            {groups.map((group) => (
                <Card key={group.phone} className="overflow-hidden border-destructive/20 shadow-sm relative">
                    <div className="absolute top-0 left-0 w-1.5 h-full bg-destructive/30" />
                    <CardHeader className="bg-muted/30 pb-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="text-xl flex items-center gap-2">
                                    <Key className="w-5 h-5 text-muted-foreground" />
                                    전화번호: <span className="font-mono bg-background px-2 py-0.5 rounded border">{group.phone}</span>
                                </CardTitle>
                                <CardDescription className="mt-1.5">
                                    이 전화번호를 공유하는 {group.entities.length}명의 인물 데이터가 있습니다.
                                </CardDescription>
                            </div>
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    onClick={() => handleIgnore(group.phone, group.entities.map(e => e.id))}
                                    disabled={loadingIds.has(group.phone)}
                                >
                                    <XCircle className="w-4 h-4 mr-2 text-muted-foreground" />
                                    모두 동명이인 (병합 제외)
                                </Button>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {group.entities.map((entity, idx) => {
                                const roleCodes = entity.membership_roles?.map((r: any) => r.role_code) || [];
                                const certsCount = entity.certificate_registry?.length || 0;
                                const otherEntities = group.entities.filter(e => e.id !== entity.id).map(e => e.id);
                                const isMergeLoading = loadingIds.has(group.phone);

                                return (
                                    <Card key={entity.id} className="border shadow-none flex flex-col items-start relative overflow-hidden bg-card/60 hover:bg-card transition-colors">
                                        <CardHeader className="p-4 pb-2 w-full border-b bg-muted/10">
                                            <div className="flex justify-between items-start">
                                                <div className="font-semibold text-lg">{entity.display_name}</div>
                                                <div className="text-xs text-muted-foreground font-mono">...{entity.id.slice(-6)}</div>
                                            </div>
                                            {roleCodes.length > 0 && (
                                                <div className="flex flex-wrap gap-1 mt-2">
                                                    {roleCodes.map((r: string) => (
                                                        <Badge key={r} variant="secondary" className="text-xs">{r}</Badge>
                                                    ))}
                                                </div>
                                            )}
                                        </CardHeader>
                                        <CardContent className="p-4 text-sm space-y-3 w-full grow">
                                            <div className="grid grid-cols-3 gap-1">
                                                <span className="text-muted-foreground font-medium">회원번호</span>
                                                <span className="col-span-2 font-mono">{(entity.membership_roles && entity.membership_roles[0]?.source_member_id) || '-'}</span>
                                            </div>
                                            <div className="grid grid-cols-3 gap-1">
                                                <span className="text-muted-foreground font-medium">권리증</span>
                                                <span className="col-span-2">{certsCount > 0 ? <span className="text-emerald-600 font-bold">{certsCount}개</span> : '없음'}</span>
                                            </div>
                                            {entity.memo && (
                                                <div className="mt-3 pt-3 border-t">
                                                    <span className="text-xs text-muted-foreground font-medium mb-1 block">메모</span>
                                                    <ScrollArea className="h-[60px] w-full rounded border bg-muted/20 p-2 text-xs text-muted-foreground">
                                                        {entity.memo}
                                                    </ScrollArea>
                                                </div>
                                            )}
                                        </CardContent>
                                        <CardFooter className="p-4 pt-0 w-full mt-auto">
                                            <Button 
                                                variant="default" 
                                                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                                                onClick={() => handleMerge(group.phone, entity.id, otherEntities)}
                                                disabled={isMergeLoading}
                                            >
                                                <Check className="w-4 h-4 mr-2" />
                                                이 사람으로 병합 (Master)
                                            </Button>
                                        </CardFooter>
                                    </Card>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}
