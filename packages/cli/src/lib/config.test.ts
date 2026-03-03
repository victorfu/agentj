import { homedir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { resolveCliConfig } from './config.js';

const ORIGINAL_AGENTJ_CONFIG_FILE = process.env.AGENTJ_CONFIG_FILE;

afterEach(() => {
  if (ORIGINAL_AGENTJ_CONFIG_FILE === undefined) {
    delete process.env.AGENTJ_CONFIG_FILE;
    return;
  }

  process.env.AGENTJ_CONFIG_FILE = ORIGINAL_AGENTJ_CONFIG_FILE;
});

describe('config file path', () => {
  it('uses ~/.agentj/config.yml by default', () => {
    delete process.env.AGENTJ_CONFIG_FILE;
    const config = resolveCliConfig();

    expect(config.configFile).toBe(join(homedir(), '.agentj', 'config.yml'));
  });

  it('supports AGENTJ_CONFIG_FILE override', () => {
    process.env.AGENTJ_CONFIG_FILE = '.custom-agentj/config.yml';
    const config = resolveCliConfig();

    expect(config.configFile).toBe(join(homedir(), '.custom-agentj/config.yml'));
  });
});
