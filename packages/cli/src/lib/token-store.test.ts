import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { loadToken, saveToken } from './token-store.js';

describe('token store', () => {
  it('saves authtoken to config file', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'agentj-cli-token-'));
    const file = join(dir, 'config.yml');

    await saveToken('agentj_pat_demo', file);
    const content = await readFile(file, 'utf8');

    expect(content).toContain('authtoken: agentj_pat_demo');
    expect(await loadToken(file)).toBe('agentj_pat_demo');
  });

  it('updates existing authtoken while preserving other config', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'agentj-cli-token-'));
    const file = join(dir, 'config.yml');

    await writeFile(file, 'region: ap\nauthtoken: old_token\n', 'utf8');
    await saveToken('new token', file);
    const content = await readFile(file, 'utf8');

    expect(content).toContain('region: ap');
    expect(content).toContain("authtoken: 'new token'");
    expect(await loadToken(file)).toBe('new token');
  });

  it('does not capture the next key when authtoken value is empty', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'agentj-cli-token-'));
    const file = join(dir, 'config.yml');

    await writeFile(file, 'authtoken:\nregion: ap\n', 'utf8');
    expect(await loadToken(file)).toBeNull();

    await saveToken('agentj_pat_demo', file);
    const content = await readFile(file, 'utf8');
    expect(content).toContain('authtoken: agentj_pat_demo');
    expect(content).toContain('region: ap');
  });

  it('does not replace nested authtoken keys', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'agentj-cli-token-'));
    const file = join(dir, 'config.yml');

    await writeFile(file, 'profiles:\n  authtoken: nested_value\nregion: ap\n', 'utf8');
    await saveToken('agentj_pat_demo', file);
    const content = await readFile(file, 'utf8');

    expect(content).toContain('profiles:\n  authtoken: nested_value');
    expect(content).toContain('authtoken: agentj_pat_demo');
  });

  it('falls back to legacy token file and migrates to config file', async () => {
    const homeDir = await mkdtemp(join(tmpdir(), 'agentj-cli-home-'));
    const legacyDir = join(homeDir, '.agentj');
    const legacyFile = join(legacyDir, 'pat-token');

    await mkdir(legacyDir, { recursive: true });
    await writeFile(legacyFile, 'legacy_token\n', 'utf8');

    const configDir = await mkdtemp(join(tmpdir(), 'agentj-cli-token-'));
    const configFile = join(configDir, 'config.yml');

    const previousHome = process.env.HOME;
    const previousLegacyPath = process.env.AGENTJ_PAT_STORAGE_FILE;
    process.env.HOME = homeDir;
    delete process.env.AGENTJ_PAT_STORAGE_FILE;

    try {
      expect(await loadToken(configFile)).toBe('legacy_token');
    } finally {
      if (previousHome === undefined) {
        delete process.env.HOME;
      } else {
        process.env.HOME = previousHome;
      }

      if (previousLegacyPath === undefined) {
        delete process.env.AGENTJ_PAT_STORAGE_FILE;
      } else {
        process.env.AGENTJ_PAT_STORAGE_FILE = previousLegacyPath;
      }
    }

    const migrated = await readFile(configFile, 'utf8');
    expect(migrated).toContain('authtoken: legacy_token');
  });
});
