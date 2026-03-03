import { describe, expect, it } from 'vitest';

import { resolveCliConfig } from './config.js';

describe('cli config', () => {
  it('resolves defaults', () => {
    const config = resolveCliConfig();
    expect(config.apiBaseUrl.length).toBeGreaterThan(0);
  });
});
