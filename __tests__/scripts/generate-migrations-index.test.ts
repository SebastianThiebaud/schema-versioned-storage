import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { exec } from 'child_process';
import { promisify } from 'util';
import {
  readFile,
  writeFile,
  mkdir,
  mkdtemp,
  rm,
  readdir,
} from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

const execAsync = promisify(exec);

describe('generate-migrations-index.mjs', () => {
  let tempDir: string;
  let migrationsDir: string;
  let indexPath: string;
  const scriptPath = join(process.cwd(), 'scripts', 'generate-migrations-index.mjs');

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'migrations-test-'));
    migrationsDir = join(tempDir, 'migrations');
    indexPath = join(migrationsDir, 'index.ts');
    await mkdir(migrationsDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('should generate index file with no migrations', async () => {
    const { stdout, stderr } = await execAsync(
      `node ${scriptPath} --migrations-dir ${migrationsDir} --index-path ${indexPath}`
    );

    const indexContent = await readFile(indexPath, 'utf-8');
    expect(indexContent).toContain('Auto-generated file');
    expect(indexContent).toContain('getMigrations');
    expect(indexContent).toContain('getCurrentSchemaVersion');
    expect(indexContent).toContain('return 1'); // Default version when no migrations
  });

  it('should generate index file with single migration', async () => {
    // Create a migration file
    const migrationContent = `import type { Migration } from 'schema-versioned-storage';
const migration: Migration = {
  metadata: { version: 2, description: 'Test migration' },
  migrate: (state) => state,
};
export default migration;`;

    await writeFile(join(migrationsDir, '2-test-migration.ts'), migrationContent);

    await execAsync(
      `node ${scriptPath} --migrations-dir ${migrationsDir} --index-path ${indexPath}`
    );

    const indexContent = await readFile(indexPath, 'utf-8');
    expect(indexContent).toContain("import migration0 from './2-test-migration'");
    expect(indexContent).toContain('registry.set(2, migration0)');
    expect(indexContent).toContain('Math.max'); // Should calculate max version
  });

  it('should generate index file with multiple migrations in order', async () => {
    // Create multiple migration files
    await writeFile(
      join(migrationsDir, '2-first-migration.ts'),
      `import type { Migration } from 'schema-versioned-storage';
const migration: Migration = {
  metadata: { version: 2, description: 'First' },
  migrate: (state) => state,
};
export default migration;`
    );

    await writeFile(
      join(migrationsDir, '3-second-migration.ts'),
      `import type { Migration } from 'schema-versioned-storage';
const migration: Migration = {
  metadata: { version: 3, description: 'Second' },
  migrate: (state) => state,
};
export default migration;`
    );

    await writeFile(
      join(migrationsDir, '1-initial-migration.ts'),
      `import type { Migration } from 'schema-versioned-storage';
const migration: Migration = {
  metadata: { version: 1, description: 'Initial' },
  migrate: (state) => state,
};
export default migration;`
    );

    await execAsync(
      `node ${scriptPath} --migrations-dir ${migrationsDir} --index-path ${indexPath}`
    );

    const indexContent = await readFile(indexPath, 'utf-8');
    // Should be in order: 1, 2, 3
    const import1Index = indexContent.indexOf("import migration0 from './1-initial-migration'");
    const import2Index = indexContent.indexOf("import migration1 from './2-first-migration'");
    const import3Index = indexContent.indexOf("import migration2 from './3-second-migration'");

    expect(import1Index).toBeLessThan(import2Index);
    expect(import2Index).toBeLessThan(import3Index);

    expect(indexContent).toContain('registry.set(1, migration0)');
    expect(indexContent).toContain('registry.set(2, migration1)');
    expect(indexContent).toContain('registry.set(3, migration2)');
    expect(indexContent).toContain('Math.max'); // Should calculate max version
  });

  it('should use custom types path', async () => {
    await execAsync(
      `node ${scriptPath} --migrations-dir ${migrationsDir} --index-path ${indexPath} --types-path ./custom-types`
    );

    const indexContent = await readFile(indexPath, 'utf-8');
    expect(indexContent).toContain("import type { Migration } from './custom-types'");
  });

  it('should use config file with nested format', async () => {
    const configFile = join(tempDir, 'config.json');
    await writeFile(
      configFile,
      JSON.stringify({
        migrations: {
          dir: migrationsDir,
          indexPath: indexPath,
          typesPath: 'custom-package',
        },
      })
    );

    await execAsync(`node ${scriptPath} --config ${configFile}`);

    const indexContent = await readFile(indexPath, 'utf-8');
    expect(indexContent).toContain("import type { Migration } from 'custom-package'");
  });

  it('should use config file with flat format', async () => {
    const configFile = join(tempDir, 'config.json');
    await writeFile(
      configFile,
      JSON.stringify({
        migrationsDir: migrationsDir,
        indexPath: indexPath,
        typesPath: 'flat-package',
      })
    );

    await execAsync(`node ${scriptPath} --config ${configFile}`);

    const indexContent = await readFile(indexPath, 'utf-8');
    expect(indexContent).toContain("import type { Migration } from 'flat-package'");
  });

  it('should use package.json configuration', async () => {
    const packageJsonPath = join(tempDir, 'package.json');
    await writeFile(
      packageJsonPath,
      JSON.stringify({
        name: 'test-app',
        schemaVersionedStorage: {
          migrations: {
            dir: migrationsDir,
            indexPath: indexPath,
            typesPath: 'package-json-types',
          },
        },
      })
    );

    // Run script from temp directory using cwd option
    await execAsync(`node ${scriptPath}`, { cwd: tempDir });

    const indexContent = await readFile(indexPath, 'utf-8');
    expect(indexContent).toContain("import type { Migration } from 'package-json-types'");
  });

  it('should handle CLI args overriding package.json', async () => {
    const packageJsonPath = join(tempDir, 'package.json');
    await writeFile(
      packageJsonPath,
      JSON.stringify({
        name: 'test-app',
        schemaVersionedStorage: {
          migrations: {
            dir: migrationsDir,
            indexPath: indexPath,
            typesPath: 'package-json-types',
          },
        },
      })
    );

    // Run script from temp directory using cwd option
    await execAsync(
      `node ${scriptPath} --types-path cli-override-types`,
      { cwd: tempDir }
    );

    const indexContent = await readFile(indexPath, 'utf-8');
    expect(indexContent).toContain("import type { Migration } from 'cli-override-types'");
  });

  it('should filter out non-migration files', async () => {
    // Create migration and non-migration files
    await writeFile(
      join(migrationsDir, '2-valid-migration.ts'),
      `export default {};`
    );
    await writeFile(join(migrationsDir, 'invalid-file.ts'), 'not a migration');
    await writeFile(join(migrationsDir, 'README.md'), '# Migrations');

    await execAsync(
      `node ${scriptPath} --migrations-dir ${migrationsDir} --index-path ${indexPath}`
    );

    const indexContent = await readFile(indexPath, 'utf-8');
    expect(indexContent).toContain('2-valid-migration');
    expect(indexContent).not.toContain('invalid-file');
    expect(indexContent).not.toContain('README');
  });

  it('should create directory if it does not exist', async () => {
    const nestedPath = join(tempDir, 'nested', 'deep', 'index.ts');
    await execAsync(
      `node ${scriptPath} --migrations-dir ${migrationsDir} --index-path ${nestedPath}`
    );

    const indexContent = await readFile(nestedPath, 'utf-8');
    expect(indexContent).toBeTruthy();
  });
});

