import { describe, it, expect } from 'vitest';
import { runMigrations, createMigrationRegistry } from '../../src/core/migrations';
import type { Migration } from '../../src/types';

describe('runMigrations', () => {
  it('should return state unchanged if versions are the same', () => {
    const state = { _version: 1, value: 'test' };
    const result = runMigrations(state, 1, 1, []);
    expect(result).toEqual(state);
  });

  it('should run migrations in order', () => {
    const migrations: Migration[] = [
      {
        metadata: { version: 2, description: 'Add field' },
        migrate: (state: any) => ({
          ...state,
          _version: 2,
          newField: 'added',
        }),
      },
      {
        metadata: { version: 3, description: 'Modify field' },
        migrate: (state: any) => ({
          ...state,
          _version: 3,
          newField: 'modified',
        }),
      },
    ];

    const state = { _version: 1, value: 'test' };
    const result = runMigrations(state, 1, 3, migrations);
    expect(result._version).toBe(3);
    expect((result as any).newField).toBe('modified');
    expect((result as any).value).toBe('test');
  });

  it('should throw error if migrating backwards', () => {
    const state = { _version: 3 };
    expect(() => {
      runMigrations(state, 3, 1, []);
    }).toThrow('Cannot migrate backwards');
  });

  it('should throw error if migrations are missing', () => {
    const state = { _version: 1 };
    const migrations: Migration[] = [
      {
        metadata: { version: 3, description: 'Skip version 2' },
        migrate: (state: any) => ({ ...state, _version: 3 }),
      },
    ];

    expect(() => {
      runMigrations(state, 1, 3, migrations);
    }).toThrow('Missing migrations');
  });

  it('should handle migration errors', () => {
    const migrations: Migration[] = [
      {
        metadata: { version: 2, description: 'Failing migration' },
        migrate: () => {
          throw new Error('Migration failed');
        },
      },
    ];

    const state = { _version: 1 };
    expect(() => {
      runMigrations(state, 1, 2, migrations);
    }).toThrow('Migration 2');
  });

  it('should handle migration errors with non-Error objects', () => {
    const migrations: Migration[] = [
      {
        metadata: { version: 2, description: 'Failing migration' },
        migrate: () => {
          throw 'String error'; // Not an Error instance
        },
      },
    ];

    const state = { _version: 1 };
    expect(() => {
      runMigrations(state, 1, 2, migrations);
    }).toThrow('Migration 2');
  });
});

describe('createMigrationRegistry', () => {
  it('should create an empty registry', () => {
    const registry = createMigrationRegistry();
    expect(registry).toBeInstanceOf(Map);
    expect(registry.size).toBe(0);
  });

  it('should allow adding migrations', () => {
    const registry = createMigrationRegistry();
    const migration: Migration = {
      metadata: { version: 1, description: 'Test' },
      migrate: (state) => state,
    };
    registry.set(1, migration);
    expect(registry.size).toBe(1);
    expect(registry.get(1)).toBe(migration);
  });
});

