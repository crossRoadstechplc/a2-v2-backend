import { describe, it, expect } from 'vitest';
import {
  generateSessionToken,
  hashSessionToken,
  verifySessionToken,
} from '../src/services/session/index.js';

describe('Session token', () => {
  it('generateSessionToken returns 64-char hex string', () => {
    const token = generateSessionToken();
    expect(token).toMatch(/^[a-f0-9]{64}$/);
  });

  it('hashSessionToken produces consistent hash', () => {
    const token = 'abc123';
    expect(hashSessionToken(token)).toBe(hashSessionToken(token));
  });

  it('verifySessionToken returns true for matching token', () => {
    const token = generateSessionToken();
    const hash = hashSessionToken(token);
    expect(verifySessionToken(token, hash)).toBe(true);
  });

  it('verifySessionToken returns false for wrong token', () => {
    const hash = hashSessionToken('token1');
    expect(verifySessionToken('token2', hash)).toBe(false);
  });
});
