import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

const AUTHTOKEN_KEY = 'authtoken';
const AUTHTOKEN_LINE = /^authtoken\s*:/m;
const AUTHTOKEN_VALUE = /^authtoken\s*:[ \t]*([^\r\n]*)[ \t]*$/m;

const LEGACY_SERVICE_NAME = 'agentj-cli';
const LEGACY_ACCOUNT_NAME = 'default';
const LEGACY_TOKEN_FILE = '.agentj/pat-token';

type KeytarModule = {
  getPassword: (service: string, account: string) => Promise<string | null>;
};

export async function saveToken(token: string, configFilePath: string): Promise<'config'> {
  const currentConfig = await loadConfigFile(configFilePath);
  const escapedToken = toYamlScalar(token);
  const authtokenLine = `${AUTHTOKEN_KEY}: ${escapedToken}`;

  const nextConfig = AUTHTOKEN_LINE.test(currentConfig)
    ? currentConfig.replace(AUTHTOKEN_VALUE, authtokenLine)
    : appendLine(currentConfig, authtokenLine);

  await mkdir(dirname(configFilePath), { recursive: true });
  await writeFile(configFilePath, ensureTrailingNewline(nextConfig), { mode: 0o600 });
  return 'config';
}

export async function loadToken(configFilePath: string): Promise<string | null> {
  const fromConfig = await loadTokenFromConfig(configFilePath);
  if (fromConfig !== undefined) {
    return fromConfig;
  }

  const fromLegacy = await loadLegacyToken();
  if (!fromLegacy) {
    return null;
  }

  try {
    await saveToken(fromLegacy, configFilePath);
  } catch {
    // Keep CLI usable even if migration write fails.
  }

  return fromLegacy;
}

async function loadConfigFile(filePath: string): Promise<string> {
  try {
    return await readFile(filePath, 'utf8');
  } catch {
    return '';
  }
}

function appendLine(source: string, line: string): string {
  if (!source.trim()) {
    return line;
  }
  return `${source.replace(/\s*$/, '')}\n${line}`;
}

async function loadTokenFromConfig(configFilePath: string): Promise<string | null | undefined> {
  const content = await loadConfigFile(configFilePath);
  const match = content.match(AUTHTOKEN_VALUE);
  if (!match) {
    return undefined;
  }

  const rawValue = match[1]?.trim() ?? '';
  if (!rawValue) {
    return null;
  }

  return fromYamlScalar(rawValue);
}

async function loadLegacyToken(): Promise<string | null> {
  const keytar = await loadKeytar();
  if (keytar) {
    try {
      const keychainToken = (
        await keytar.getPassword(LEGACY_SERVICE_NAME, LEGACY_ACCOUNT_NAME)
      )?.trim();
      if (keychainToken) {
        return keychainToken;
      }
    } catch {
      // If keychain access fails, continue with legacy file fallback.
    }
  }

  const legacyTokenFilePath = resolveLegacyTokenFilePath();
  try {
    const fileToken = (await readFile(legacyTokenFilePath, 'utf8')).trim();
    return fileToken || null;
  } catch {
    return null;
  }
}

function resolveLegacyTokenFilePath(): string {
  const relativePath = process.env.AGENTJ_PAT_STORAGE_FILE?.replace(/^\//, '') ?? LEGACY_TOKEN_FILE;
  return join(homedir(), relativePath);
}

async function loadKeytar(): Promise<KeytarModule | null> {
  try {
    const mod = (await import('keytar')) as unknown as KeytarModule;
    return mod;
  } catch {
    return null;
  }
}

function ensureTrailingNewline(source: string): string {
  return source.endsWith('\n') ? source : `${source}\n`;
}

function toYamlScalar(value: string): string {
  const plain = /^[A-Za-z0-9._-]+$/;
  if (plain.test(value)) {
    return value;
  }
  return `'${value.replace(/'/g, "''")}'`;
}

function fromYamlScalar(value: string): string {
  if (value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1).replace(/''/g, "'");
  }

  if (value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1).replace(/\\"/g, '"');
  }

  return value;
}
