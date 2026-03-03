import { describe, expect, it } from 'vitest';

import { ensureLoggedIn } from './project.js';

describe('auth guard', () => {
  it('throws when token is missing', () => {
    expect(() => ensureLoggedIn({ token: undefined })).toThrow('No token found');
  });

  it('passes when token exists', () => {
    expect(() => ensureLoggedIn({ token: 'pat_1' })).not.toThrow();
  });
});
