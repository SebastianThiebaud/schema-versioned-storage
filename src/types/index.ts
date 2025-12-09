/**
 * Metadata for a migration
 */
export interface MigrationMetadata {
  version: number;
  description: string;
}

/**
 * A migration that transforms state from one version to another
 */
export interface Migration<TSchema = any> {
  metadata: MigrationMetadata;
  migrate: (state: unknown) => TSchema;
}
