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
import { Edit2, Loader2 } from 'lucide-react';
import { updateMember } from '@/app/actions/member';

export function EditMemberDialog({ member }: { member: any }) {
    const [open, setOpen] = useState(false);
    const [state, formAction, isPending] = useActionState(updateMember, { success: false });

    useEffect(() => {
        if (state.success) {
            setOpen(false);
        }
    }, [state.success]);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                    <Edit2 className="w-3.5 h-3.5" />
                    정보 수정
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>조합원 정보 수정</DialogTitle>
                    <DialogDescription>
                        조합원의 인적사항 및 가입 상태를 변경합니다.
                    </DialogDescription>
                </DialogHeader>

                <form action={formAction} className="grid gap-4 py-4">
                    <input type="hidden" name="id" value={member.id} />

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">성명</Label>
                            <Input id="name" name="name" defaultValue={member.name} required />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="member_number">권리증NO</Label>
                            <Input id="member_number" name="member_number" defaultValue={member.member_number} />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="phone">전화번호</Label>
                            <Input id="phone" name="phone" defaultValue={member.phone} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="unit_group">평형 타입</Label>
                            <Input id="unit_group" name="unit_group" defaultValue={member.unit_group} />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>등급(Tier)</Label>
                            <Select name="tier" defaultValue={member.tier}>
                                <SelectTrigger>
                                    <SelectValue placeholder="등급 선택" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="1차">1차</SelectItem>
                                    <SelectItem value="2차">2차</SelectItem>
                                    <SelectItem value="3차">3차</SelectItem>
                                    <SelectItem value="지주">지주</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>상태</Label>
                            <Select name="status" defaultValue={member.status}>
                                <SelectTrigger>
                                    <SelectValue placeholder="상태 선택" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="정상">정상</SelectItem>
                                    <SelectItem value="탈퇴예정">탈퇴예정</SelectItem>
                                    <SelectItem value="소송">소송</SelectItem>
                                    <SelectItem value="환불완료">환불완료</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="memo">비고</Label>
                        <Textarea
                            id="memo"
                            name="memo"
                            defaultValue={member.memo}
                            className="h-20 resize-none"
                        />
                    </div>

                    {state.error && (
                        <p className="text-sm text-red-500 font-medium">{state.error}</p>
                    )}

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                            취소
                        </Button>
                        <Button type="submit" disabled={isPending}>
                            {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            저장하기
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
