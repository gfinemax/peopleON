"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

interface MemberCreateDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function MemberCreateDialog({ open, onOpenChange }: MemberCreateDialogProps) {
    const router = useRouter()
    const [loading, setLoading] = React.useState(false)
    const [formData, setFormData] = React.useState({
        name: "",
        phone: "",
        member_number: "",
        right_number: "",
        tier: "예비조합원",
        unit_group: "",
        address_legal: "",
        memo: "",
        birth_date: "",
        resident_registration_number: "",
    })

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        // Validation: Prevent date-like strings from being added as certificates
        const isDateLike = (v: string): boolean => {
            const s = v.trim();
            const m = s.match(/^(19[2-9]\d|20[0-1]\d)[\.\-](\d{1,2})[\.\-](\d{1,2})$/);
            if (m) return +m[2] >= 1 && +m[2] <= 12 && +m[3] >= 1 && +m[3] <= 31;
            const m2 = s.match(/^(19[2-9]\d|20[0-1]\d)(\d{2})(\d{2})$/);
            if (m2) return +m2[2] >= 1 && +m2[2] <= 12 && +m2[3] >= 1 && +m2[3] <= 31;
            return false;
        };
        if (formData.right_number && isDateLike(formData.right_number)) {
            if (!confirm('입력하신 권리증 번호가 생년월일 형식과 유사합니다. 권리증 번호가 확실한가요?')) {
                return;
            }
        }

        setLoading(true)

        try {
            const res = await fetch("/api/members/create", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData),
            })

            const data = await res.json()
            if (data.success) {
                onOpenChange(false)
                router.refresh()
                // Reset form
                setFormData({
                    name: "",
                    phone: "",
                    member_number: "",
                    right_number: "",
                    tier: "예비조합원",
                    unit_group: "",
                    address_legal: "",
                    memo: "",
                    birth_date: "",
                    resident_registration_number: "",
                })
            } else {
                alert(data.error || "등록 중 오류가 발생했습니다.")
            }
        } catch (error) {
            alert("등록 중 오류가 발생했습니다.")
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px] bg-slate-900 border-slate-800 text-slate-100">
                <DialogHeader>
                    <DialogTitle>신규 인원 추가</DialogTitle>
                    <DialogDescription className="text-slate-400">
                        새로운 인원 정보를 입력하여 리스트에 등록합니다.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="name" className="text-right text-slate-400">성명 *</Label>
                        <Input
                            id="name"
                            required
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="col-span-3 bg-slate-800 border-slate-700"
                            placeholder="이름 입력"
                        />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="phone" className="text-right text-slate-400">연락처</Label>
                        <Input
                            id="phone"
                            value={formData.phone}
                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                            className="col-span-3 bg-slate-800 border-slate-700"
                            placeholder="010-0000-0000"
                        />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="birth_date" className="text-right text-slate-400">생년월일</Label>
                        <Input
                            id="birth_date"
                            value={formData.birth_date}
                            onChange={(e) => setFormData({ ...formData, birth_date: e.target.value })}
                            className="col-span-3 bg-slate-800 border-slate-700"
                            placeholder="YYYY-MM-DD"
                        />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="member_number" className="text-right text-slate-400">번호</Label>
                        <Input
                            id="member_number"
                            value={formData.member_number}
                            onChange={(e) => setFormData({ ...formData, member_number: e.target.value })}
                            className="col-span-3 bg-slate-800 border-slate-700 font-mono"
                            placeholder="고유 번호"
                        />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="resident_registration_number" className="text-right text-slate-400">주민번호</Label>
                        <Input
                            id="resident_registration_number"
                            value={formData.resident_registration_number}
                            onChange={(e) => setFormData({ ...formData, resident_registration_number: e.target.value })}
                            className="col-span-3 bg-slate-800 border-slate-700"
                            placeholder="000000-0000000"
                        />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="right_number" className="text-right text-sky-400 font-bold">권리증번호</Label>
                        <Input
                            id="right_number"
                            value={formData.right_number}
                            onChange={(e) => setFormData({ ...formData, right_number: e.target.value })}
                            className="col-span-3 bg-slate-800 border-slate-700 border-sky-500/30 font-mono text-sky-200"
                            placeholder="권리증 번호 입력"
                        />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="tier" className="text-right text-slate-400">구분 *</Label>
                        <div className="col-span-3">
                            <Select
                                value={formData.tier}
                                onValueChange={(val) => setFormData({ ...formData, tier: val })}
                            >
                                <SelectTrigger className="w-full bg-slate-800 border-slate-700 text-slate-100">
                                    <SelectValue placeholder="구분 선택" />
                                </SelectTrigger>
                                <SelectContent className="bg-slate-800 border-slate-700 text-slate-100">
                                    <SelectItem value="등기조합원">조합원(등기)</SelectItem>
                                    <SelectItem value="지주조합원">조합원(지주)</SelectItem>
                                    <SelectItem value="2차">2차</SelectItem>
                                    <SelectItem value="일반분양">조합원(일반분양)</SelectItem>
                                    <SelectItem value="예비조합원">조합원(예비)</SelectItem>
                                    <SelectItem value="권리증보유자">권리증보유</SelectItem>
                                    <SelectItem value="지주">원지주</SelectItem>
                                    <SelectItem value="대리인">대리인</SelectItem>
                                    <SelectItem value="관계인">관계인</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="unit_group" className="text-right text-slate-400">그룹/동호수</Label>
                        <Input
                            id="unit_group"
                            value={formData.unit_group}
                            onChange={(e) => setFormData({ ...formData, unit_group: e.target.value })}
                            className="col-span-3 bg-slate-800 border-slate-700"
                            placeholder="예: 101동 101호"
                        />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="memo" className="text-right text-slate-400">메모</Label>
                        <Textarea
                            id="memo"
                            value={formData.memo}
                            onChange={(e) => setFormData({ ...formData, memo: e.target.value })}
                            className="col-span-3 bg-slate-800 border-slate-700"
                            placeholder="특이사항 입력"
                        />
                    </div>
                    <DialogFooter>
                        <Button
                            type="submit"
                            disabled={loading}
                            className="bg-sky-600 hover:bg-sky-500 text-white"
                        >
                            {loading ? "등록 중..." : "등록하기"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
