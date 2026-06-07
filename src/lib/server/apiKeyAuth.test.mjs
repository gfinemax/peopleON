import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
    extractApiKey,
    getConfiguredApiKeys,
    hasValidApiKey,
    MEMBERS_API_KEY_HEADER,
} from './apiKeyAuth.ts';

describe('API key auth helpers', () => {
    it('parses comma separated configured keys', () => {
        assert.deepEqual(getConfiguredApiKeys(' first-key, second-key ,, '), ['first-key', 'second-key']);
    });

    it('extracts the API key from the x-api-key header', () => {
        const headers = new Headers({ [MEMBERS_API_KEY_HEADER]: 'external-key' });

        assert.equal(extractApiKey(headers), 'external-key');
    });

    it('accepts only configured API keys', () => {
        assert.equal(hasValidApiKey(new Headers({ [MEMBERS_API_KEY_HEADER]: 'external-key' }), ['external-key']), true);
        assert.equal(hasValidApiKey(new Headers({ [MEMBERS_API_KEY_HEADER]: 'wrong-key' }), ['external-key']), false);
        assert.equal(hasValidApiKey(new Headers(), ['external-key']), false);
        assert.equal(hasValidApiKey(new Headers({ [MEMBERS_API_KEY_HEADER]: 'external-key' }), []), false);
    });
});
