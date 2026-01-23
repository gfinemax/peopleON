'use client';

import { useActionState, useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PlusCircle, Loader2 } from 'lucide-react';
import { logInteraction } from '@/app/actions/interaction';

export function LogInteractionDialog({ memberId }: { memberId: string }) {
    const [open, setOpen] = useState(false);
    const [state, formAction, isPending] = useActionState(logInteraction, {});

    // Close dialog on success
    useEffect(() => {
        if (state.success) {
            setOpen(false);
            // Reset logic if needed, but state is immutable here usually
        }
    }, [state.success]);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="gap-2">
                    <PlusCircle className="w-4 h-4" />
                    상담 로그 작성
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>상담 활동 기록</DialogTitle>
                    <DialogDescription>
                        조합원과의 통화, 미팅 등 접점 내용을 기록합니다.
                    </DialogDescription>
                </DialogHeader>

                <form action={formAction} className="grid gap-4 py-4">
                    <input type="hidden" name="memberId" value={memberId} />

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>활동 유형</Label>
                            <Select name="type" required defaultValue="CALL">
                                <SelectTrigger>
                                    <SelectValue placeholder="유형 선택" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="CALL">전화 (Call)</SelectItem>
                                    <SelectItem value="MEET">미팅 (Meet)</SelectItem>
                                    <SelectItem value="SMS">문자 (SMS)</SelectItem>
                                    <SelectItem value="DOC">문서/서류</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>방향</Label>
                            <Select name="direction" required defaultValue="Outbound">
                                <SelectTrigger>
                                    <SelectValue placeholder="방향 선택" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Outbound">발신 (Out)</SelectItem>
                                    <SelectItem value="Inbound">수신 (In)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>내용 요약</Label>
                        <Textarea
                            name="summary"
                            placeholder="상담 내용을 상세히 기록하세요..."
                            required
                            className="h-32 resize-none"
                        />
                    </div>

                    {state.error && (
                        <p className="text-sm text-red-500">{state.error}</p>
                    )}

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                            취소
                        </Button>
                        <Button type="submit" disabled={isPending}>
                            {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            기록 저장
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
