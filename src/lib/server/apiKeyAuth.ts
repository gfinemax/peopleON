import { timingSafeEqual } from 'node:crypto';

export const MEMBERS_API_KEY_HEADER = 'x-api-key';
const MEMBERS_API_KEYS_ENV = 'PEOPLEON_MEMBERS_API_KEYS';
const MEMBERS_API_KEY_ENV = 'PEOPLEON_MEMBERS_API_KEY';

export function getConfiguredApiKeys(rawValue?: string | null) {
    const configuredValue =
        rawValue ??
        process.env[MEMBERS_API_KEYS_ENV] ??
        process.env[MEMBERS_API_KEY_ENV] ??
        '';

    return configuredValue
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);
}

export function extractApiKey(headers: Pick<Headers, 'get'>) {
    const headerValue = headers.get(MEMBERS_API_KEY_HEADER);
    if (headerValue?.trim()) {
        return headerValue.trim();
    }

    const authorization = headers.get('authorization') || headers.get('Authorization');
    const bearerPrefix = 'Bearer ';
    if (authorization?.startsWith(bearerPrefix)) {
        return authorization.slice(bearerPrefix.length).trim();
    }

    return null;
}

function safeEqual(left: string, right: string) {
    const leftBuffer = Buffer.from(left);
    const rightBuffer = Buffer.from(right);

    if (leftBuffer.length !== rightBuffer.length) {
        return false;
    }

    return timingSafeEqual(leftBuffer, rightBuffer);
}

export function hasValidApiKey(headers: Pick<Headers, 'get'>, configuredKeys = getConfiguredApiKeys()) {
    const providedKey = extractApiKey(headers);
    if (!providedKey || configuredKeys.length === 0) {
        return false;
    }

    return configuredKeys.some((configuredKey) => safeEqual(providedKey, configuredKey));
}
