export type SalePriceCategory = 'first' | 'second' | 'general';

type SalePriceUnitType = {
    name?: string | null;
    area_sqm?: number | null;
    total_contribution: number;
    first_sale_price?: number | null;
    second_sale_price?: number | null;
    general_sale_price?: number | null;
};

const DEFAULT_SALE_PRICE_PRESETS: Record<string, { first: number; second: number; general: number }> = {
    '59': { first: 750_000_000, second: 1_000_000_000, general: 1_100_000_000 },
    '73': { first: 925_000_000, second: 1_325_000_000, general: 1_475_000_000 },
    '74': { first: 925_000_000, second: 1_325_000_000, general: 1_475_000_000 },
    '84': { first: 999_000_000, second: 1_399_000_000, general: 1_549_000_000 },
};

function getUnitPresetKey(unitType: SalePriceUnitType | undefined) {
    if (!unitType) return null;
    const area = Number(unitType.area_sqm);
    if (Number.isFinite(area) && DEFAULT_SALE_PRICE_PRESETS[String(Math.round(area))]) {
        return String(Math.round(area));
    }

    const name = unitType.name || '';
    if (name.includes('59')) return '59';
    if (name.includes('73') || name.includes('74')) return '73';
    if (name.includes('84')) return '84';
    return null;
}

export function resolveSalePriceCategory(memberTiers: string[] = [], isRegistered = false): SalePriceCategory {
    if (isRegistered || memberTiers.some((tier) => tier === '등기조합원' || tier === '1차')) return 'first';
    if (memberTiers.some((tier) => tier === '2차')) return 'second';
    if (memberTiers.some((tier) => tier === '일반분양' || tier === '일반' || tier === '3차')) return 'general';
    return 'first';
}

export function getSalePriceCategoryLabel(category: SalePriceCategory) {
    if (category === 'first') return '1차 분양가';
    if (category === 'second') return '2차 분양가';
    return '일반분양가';
}

export function getSalePriceForCategory(unitType: SalePriceUnitType | undefined, category: SalePriceCategory) {
    if (!unitType) return 0;
    const presetKey = getUnitPresetKey(unitType);
    const preset = presetKey ? DEFAULT_SALE_PRICE_PRESETS[presetKey] : null;

    if (category === 'first') return Number(unitType.first_sale_price ?? preset?.first ?? unitType.total_contribution) || 0;
    if (category === 'second') return Number(unitType.second_sale_price ?? preset?.second ?? unitType.total_contribution) || 0;
    return Number(unitType.general_sale_price ?? preset?.general ?? unitType.total_contribution) || 0;
}
