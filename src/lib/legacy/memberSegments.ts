export type LegacyMemberSegment =
  | "registered_116"
  | "reserve_member"
  | "second_member"
  | "landlord_member"
  | "general_sale"
  | "refunded"
  | "investor";

export const LEGACY_MEMBER_SEGMENT_OPTIONS: Array<{
  value: LegacyMemberSegment;
  label: string;
}> = [
    { value: "registered_116", label: "등기조합원116" },
    { value: "reserve_member", label: "예비조합원" },
    { value: "second_member", label: "2차조합원" },
    { value: "landlord_member", label: "지주조합원" },
    { value: "general_sale", label: "일반분양" },
    { value: "refunded", label: "환불자" },
    { value: "investor", label: "권리증보유자" },
  ];

export const LEGACY_MEMBER_SEGMENT_LABEL_MAP: Record<LegacyMemberSegment, string> =
  LEGACY_MEMBER_SEGMENT_OPTIONS.reduce((acc, option) => {
    acc[option.value] = option.label;
    return acc;
  }, {} as Record<LegacyMemberSegment, string>);
