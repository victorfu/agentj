import { describe, expect, it } from 'vitest';

import { resolveLocalHttpTarget } from './http-target.js';

describe('resolveLocalHttpTarget', () => {
  it('resolves plain port with default host', () => {
    expect(resolveLocalHttpTarget('3001', '127.0.0.1')).toEqual({
      host: '127.0.0.1',
      port: 3001
    });
  });

  it('resolves host:port', () => {
    expect(resolveLocalHttpTarget('localhost:8080', '127.0.0.1')).toEqual({
      host: 'localhost',
      port: 8080
    });
  });

  it('resolves URL input', () => {
    expect(resolveLocalHttpTarget('http://localhost:3000', '127.0.0.1')).toEqual({
      host: 'localhost',
      port: 3000
    });
  });

  it('resolves URL input without explicit port', () => {
    expect(resolveLocalHttpTarget('https://localhost', '127.0.0.1')).toEqual({
      host: 'localhost',
      port: 443
    });
  });

  it('throws for invalid input', () => {
    expect(() => resolveLocalHttpTarget('localhost', '127.0.0.1')).toThrow('Invalid target');
  });

  it('throws for non-numeric port suffix', () => {
    expect(() => resolveLocalHttpTarget('localhost:3000abc', '127.0.0.1')).toThrow(
      'Invalid port'
    );
  });
});
