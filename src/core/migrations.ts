import type { Migration } from "../types";

/**
 * Run migrations from one version to another
 */
export function runMigrations<TSchema>(
  state: unknown,
  fromVersion: number,
  toVersion: number,
  migrations: Migration<TSchema>[],
): TSchema {
  if (fromVersion === toVersion) {
    return state as TSchema;
  }

  if (fromVersion > toVersion) {
    throw new Error(
      `Cannot migrate backwards from version ${fromVersion} to ${toVersion}. Migrations only support forward migration.`,
    );
  }

  // Sort migrations by version
  const sortedMigrations = [...migrations].sort(
    (a, b) => a.metadata.version - b.metadata.version,
  );

  // Filter migrations that need to run
  const migrationsToRun = sortedMigrations.filter(
    (m) => m.metadata.version > fromVersion && m.metadata.version <= toVersion,
  );

  // Verify we have all required migrations
  const expectedVersions = new Set<number>();
  for (let v = fromVersion + 1; v <= toVersion; v++) {
    expectedVersions.add(v);
  }

  const providedVersions = new Set(
    migrationsToRun.map((m) => m.metadata.version),
  );
  const missingVersions = Array.from(expectedVersions).filter(
    (v) => !providedVersions.has(v),
  );

  if (missingVersions.length > 0) {
    throw new Error(
      `Missing migrations for versions: ${missingVersions.join(", ")}. Cannot migrate from ${fromVersion} to ${toVersion}.`,
    );
  }

  // Run migrations in order
  let currentState = state;
  for (const migration of migrationsToRun) {
    try {
      currentState = migration.migrate(currentState);
    } catch (error) {
      throw new Error(
        `Migration ${migration.metadata.version} (${migration.metadata.description}) failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  return currentState as TSchema;
}

/**
 * Create a migration registry (helper for organizing migrations)
 */
export function createMigrationRegistry<TSchema>(): Map<
  number,
  Migration<TSchema>
> {
  return new Map();
}
