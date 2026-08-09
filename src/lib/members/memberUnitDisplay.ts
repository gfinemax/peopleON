export type AssignedUnitDisplay = 'sqm' | 'pyeong';

const SQM_TO_SUPPLY_PYEONG: Record<number, number> = {
    59: 24,
    84: 32,
};

const SUPPLY_PYEONG_TO_SQM: Record<number, number> = {
    24: 59,
    32: 84,
    34: 84,
};

export function formatAssignedUnitType(unitType: string, displayUnit: AssignedUnitDisplay) {
    if (unitType === '-') return '-';
    const numberMatch = unitType.match(/\d+(?:\.\d+)?/u);
    if (!numberMatch) return unitType;

    const sourceValue = Number(numberMatch[0]);
    if (!Number.isFinite(sourceValue)) return unitType;

    const isPyeongSource = /평/u.test(unitType);
    const suffix = unitType
        .replace(numberMatch[0], '')
        .replace(/^\s*(?:㎡|평형?|제곱미터)?\s*/u, '')
        .trim();

    let converted: string;
    if (displayUnit === 'sqm') {
        const sqm = isPyeongSource ? (SUPPLY_PYEONG_TO_SQM[sourceValue] || sourceValue) : sourceValue;
        converted = `${sqm}㎡`;
    } else {
        const pyeong = isPyeongSource
            ? sourceValue
            : (SQM_TO_SUPPLY_PYEONG[sourceValue] || Number((sourceValue / 3.305785).toFixed(1)));
        converted = `${pyeong}평형`;
    }

    return suffix ? `${converted} ${suffix}` : converted;
}
