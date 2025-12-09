import { describe, it, expect } from 'vitest';
import { simpleHash } from '../../src/utils/hash';

describe('simpleHash', () => {
  it('should generate a hash for a string', () => {
    const hash = simpleHash('test');
    expect(hash).toBeTruthy();
    expect(typeof hash).toBe('string');
  });

  it('should generate the same hash for the same input', () => {
    const hash1 = simpleHash('test');
    const hash2 = simpleHash('test');
    expect(hash1).toBe(hash2);
  });

  it('should generate different hashes for different inputs', () => {
    const hash1 = simpleHash('test1');
    const hash2 = simpleHash('test2');
    expect(hash1).not.toBe(hash2);
  });

  it('should handle empty strings', () => {
    const hash = simpleHash('');
    expect(hash).toBeTruthy();
    expect(typeof hash).toBe('string');
  });

  it('should handle long strings', () => {
    const longString = 'a'.repeat(1000);
    const hash = simpleHash(longString);
    expect(hash).toBeTruthy();
    expect(typeof hash).toBe('string');
  });
});

