import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

const SERVICE_NAME = 'agentj-cli';
const ACCOUNT_NAME = 'default';

type KeytarModule = {
  getPassword: (service: string, account: string) => Promise<string | null>;
  setPassword: (service: string, account: string, password: string) => Promise<void>;
};

async function loadKeytar(): Promise<KeytarModule | null> {
  try {
    const mod = (await import('keytar')) as unknown as KeytarModule;
    return mod;
  } catch {
    return null;
  }
}

export async function saveToken(token: string, filePath: string): Promise<'keychain' | 'file'> {
  const keytar = await loadKeytar();
  if (keytar) {
    await keytar.setPassword(SERVICE_NAME, ACCOUNT_NAME, token);
    return 'keychain';
  }

  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, token, { mode: 0o600 });
  return 'file';
}

export async function loadToken(filePath: string): Promise<string | null> {
  const keytar = await loadKeytar();
  if (keytar) {
    return keytar.getPassword(SERVICE_NAME, ACCOUNT_NAME);
  }

  try {
    const value = await readFile(filePath, 'utf8');
    return value.trim();
  } catch {
    return null;
  }
}
