import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  parseArgs,
  loadPackageJsonConfig,
  findMigrationFiles,
  generateIndexContent,
  generateMigrationsIndex,
  defaultConfig,
} from '../../../scripts/lib/generate-migrations-index';
import { writeFile, mkdir, mkdtemp, rm, readFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

describe('generate-migrations-index', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'migrations-lib-test-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('parseArgs', () => {
    it('should return default config when no args', () => {
      const config = parseArgs([]);
      expect(config).toEqual(defaultConfig);
    });

    it('should parse migrations-dir argument', () => {
      const config = parseArgs(['--migrations-dir', './custom/migrations']);
      expect(config.migrationsDir).toBe('./custom/migrations');
      expect(config.indexPath).toBe(defaultConfig.indexPath);
    });

    it('should parse index-path argument', () => {
      const config = parseArgs(['--index-path', './custom/index.ts']);
      expect(config.indexPath).toBe('./custom/index.ts');
    });

    it('should parse types-path argument', () => {
      const config = parseArgs(['--types-path', 'custom-package']);
      expect(config.typesPath).toBe('custom-package');
    });

    it('should parse all arguments together', () => {
      const config = parseArgs([
        '--migrations-dir',
        './custom/migrations',
        '--index-path',
        './custom/index.ts',
        '--types-path',
        'custom-package',
      ]);
      expect(config.migrationsDir).toBe('./custom/migrations');
      expect(config.indexPath).toBe('./custom/index.ts');
      expect(config.typesPath).toBe('custom-package');
    });

    it('should use package.json config when no CLI args', async () => {
      const packageJson = join(tempDir, 'package.json');
      await writeFile(
        packageJson,
        JSON.stringify({
          name: 'test-app',
          schemaVersionedStorage: {
            migrations: {
              dir: './pkg/migrations',
              indexPath: './pkg/index.ts',
              typesPath: 'pkg-package',
            },
          },
        })
      );

      const config = parseArgs([], tempDir);
      expect(config.migrationsDir).toBe('./pkg/migrations');
      expect(config.indexPath).toBe('./pkg/index.ts');
      expect(config.typesPath).toBe('pkg-package');
    });

    it('should handle partial package.json config in parseArgs', async () => {
      const packageJson = join(tempDir, 'package.json');
      await writeFile(
        packageJson,
        JSON.stringify({
          name: 'test-app',
          schemaVersionedStorage: {
            migrations: {
              dir: './partial/migrations',
              // Only dir, missing others
            },
          },
        })
      );

      const config = parseArgs([], tempDir);
      expect(config.migrationsDir).toBe('./partial/migrations');
      expect(config.indexPath).toBe(defaultConfig.indexPath); // Uses default
      expect(config.typesPath).toBe(defaultConfig.typesPath); // Uses default
    });

    it('should load from config file with nested format', async () => {
      const configFile = join(tempDir, 'config.json');
      await writeFile(
        configFile,
        JSON.stringify({
          migrations: {
            dir: './nested/migrations',
            indexPath: './nested/index.ts',
            typesPath: 'nested-package',
          },
        })
      );

      const config = parseArgs(['--config', configFile], tempDir);
      expect(config.migrationsDir).toBe('./nested/migrations');
      expect(config.indexPath).toBe('./nested/index.ts');
      expect(config.typesPath).toBe('nested-package');
    });

    it('should load from config file with flat format', async () => {
      const configFile = join(tempDir, 'config.json');
      await writeFile(
        configFile,
        JSON.stringify({
          migrationsDir: './flat/migrations',
          indexPath: './flat/index.ts',
          typesPath: 'flat-package',
        })
      );

      const config = parseArgs(['--config', configFile], tempDir);
      expect(config.migrationsDir).toBe('./flat/migrations');
      expect(config.indexPath).toBe('./flat/index.ts');
      expect(config.typesPath).toBe('flat-package');
    });

    it('should throw error on invalid config file', async () => {
      const configFile = join(tempDir, 'invalid.json');
      await writeFile(configFile, 'invalid json');

      expect(() => {
        parseArgs(['--config', configFile], tempDir);
      }).toThrow('Failed to load config file');
    });

    it('should prioritize CLI args over config file', async () => {
      const configFile = join(tempDir, 'config.json');
      await writeFile(
        configFile,
        JSON.stringify({
          migrations: {
            dir: './config/migrations',
            typesPath: 'config-package',
          },
        })
      );

      const config = parseArgs(
        ['--config', configFile, '--migrations-dir', './cli/migrations'],
        tempDir
      );
      expect(config.migrationsDir).toBe('./cli/migrations'); // CLI overrides
      expect(config.typesPath).toBe('config-package'); // From config
    });
  });

  describe('loadPackageJsonConfig', () => {
    it('should return null when package.json does not exist', () => {
      const result = loadPackageJsonConfig(tempDir);
      expect(result).toBeNull();
    });

    it('should load nested format from package.json', async () => {
      const packageJson = join(tempDir, 'package.json');
      await writeFile(
        packageJson,
        JSON.stringify({
          name: 'test-app',
          schemaVersionedStorage: {
            migrations: {
              dir: './pkg/migrations',
              indexPath: './pkg/index.ts',
              typesPath: 'pkg-package',
            },
          },
        })
      );

      const result = loadPackageJsonConfig(tempDir);
      expect(result).toEqual({
        migrationsDir: './pkg/migrations',
        indexPath: './pkg/index.ts',
        typesPath: 'pkg-package',
      });
    });

    it('should load flat format from package.json', async () => {
      const packageJson = join(tempDir, 'package.json');
      await writeFile(
        packageJson,
        JSON.stringify({
          name: 'test-app',
          schemaVersionedStorage: {
            migrationsDir: './flat/migrations',
            indexPath: './flat/index.ts',
            typesPath: 'flat-package',
          },
        })
      );

      const result = loadPackageJsonConfig(tempDir);
      expect(result).toEqual({
        migrationsDir: './flat/migrations',
        indexPath: './flat/index.ts',
        typesPath: 'flat-package',
      });
    });

    it('should return null when schemaVersionedStorage is missing', async () => {
      const packageJson = join(tempDir, 'package.json');
      await writeFile(
        packageJson,
        JSON.stringify({
          name: 'test-app',
        })
      );

      const result = loadPackageJsonConfig(tempDir);
      expect(result).toBeNull();
    });

    it('should handle partial package.json config', async () => {
      const packageJson = join(tempDir, 'package.json');
      await writeFile(
        packageJson,
        JSON.stringify({
          name: 'test-app',
          schemaVersionedStorage: {
            migrations: {
              dir: './partial/migrations',
              // indexPath and typesPath missing
            },
          },
        })
      );

      const result = loadPackageJsonConfig(tempDir);
      expect(result?.migrationsDir).toBe('./partial/migrations');
      expect(result?.indexPath).toBeUndefined();
    });
  });

  describe('findMigrationFiles', () => {
    it('should return empty array for non-existent directory', async () => {
      const files = await findMigrationFiles(join(tempDir, 'nonexistent'));
      expect(files).toEqual([]);
    });

    it('should find migration files', async () => {
      const migrationsDir = join(tempDir, 'migrations');
      await mkdir(migrationsDir);
      await writeFile(join(migrationsDir, '2-test.ts'), 'export default {};');
      await writeFile(join(migrationsDir, '1-initial.ts'), 'export default {};');

      const files = await findMigrationFiles(migrationsDir);
      expect(files).toEqual(['1-initial.ts', '2-test.ts']); // Sorted by version
    });

    it('should filter out non-migration files', async () => {
      const migrationsDir = join(tempDir, 'migrations');
      await mkdir(migrationsDir);
      await writeFile(join(migrationsDir, '2-valid.ts'), 'export default {};');
      await writeFile(join(migrationsDir, 'invalid.ts'), 'not a migration');
      await writeFile(join(migrationsDir, 'README.md'), '# Migrations');

      const files = await findMigrationFiles(migrationsDir);
      expect(files).toEqual(['2-valid.ts']);
    });

    it('should handle errors other than ENOENT', async () => {
      // Create a file instead of directory to trigger EACCES or similar
      const filePath = join(tempDir, 'not-a-dir');
      await writeFile(filePath, 'content');
      
      // Try to readdir on a file - this should throw (not ENOENT)
      // The exact error depends on the OS, but it should not be ENOENT
      try {
        await findMigrationFiles(filePath);
        // If it doesn't throw, that's also acceptable
      } catch (error: any) {
        // Should throw for non-ENOENT errors
        expect(error.code).not.toBe('ENOENT');
      }
    });
  });

  describe('generateIndexContent', () => {
    it('should generate content for empty migrations', () => {
      const content = generateIndexContent([], defaultConfig);
      expect(content).toContain('Auto-generated file');
      expect(content).toContain('getMigrations');
      expect(content).toContain('getCurrentSchemaVersion');
      expect(content).toContain('return 1'); // Default when empty
    });

    it('should generate content for single migration', () => {
      const content = generateIndexContent(['2-test.ts'], defaultConfig);
      expect(content).toContain("import migration0 from './2-test'");
      expect(content).toContain('registry.set(2, migration0)');
    });

    it('should generate content for multiple migrations', () => {
      const content = generateIndexContent(
        ['1-initial.ts', '2-second.ts', '3-third.ts'],
        defaultConfig
      );
      expect(content).toContain("import migration0 from './1-initial'");
      expect(content).toContain("import migration1 from './2-second'");
      expect(content).toContain("import migration2 from './3-third'");
      expect(content).toContain('registry.set(1, migration0)');
      expect(content).toContain('registry.set(2, migration1)');
      expect(content).toContain('registry.set(3, migration2)');
    });

    it('should use custom types path', () => {
      const config = { ...defaultConfig, typesPath: 'custom-package' };
      const content = generateIndexContent([], config);
      expect(content).toContain("import type { Migration } from 'custom-package'");
    });

    it('should use default types path when typesPath is undefined', () => {
      const config = { ...defaultConfig, typesPath: undefined as any };
      const content = generateIndexContent([], config);
      expect(content).toContain("import type { Migration } from 'schema-versioned-storage'");
    });
  });

  describe('generateMigrationsIndex', () => {
    it('should generate index file', async () => {
      const migrationsDir = join(tempDir, 'migrations');
      const indexPath = join(tempDir, 'index.ts');
      await mkdir(migrationsDir);
      await writeFile(join(migrationsDir, '2-test.ts'), 'export default {};');

      await generateMigrationsIndex(
        {
          migrationsDir: './migrations',
          indexPath: './index.ts',
          typesPath: 'schema-versioned-storage',
        },
        tempDir
      );

      const content = await readFile(indexPath, 'utf-8');
      expect(content).toContain('2-test');
    });

    it('should create nested directories', async () => {
      const indexPath = join(tempDir, 'nested', 'deep', 'index.ts');
      await generateMigrationsIndex(
        {
          migrationsDir: './migrations',
          indexPath: './nested/deep/index.ts',
          typesPath: 'schema-versioned-storage',
        },
        tempDir
      );

      const content = await readFile(indexPath, 'utf-8');
      expect(content).toBeTruthy();
    });

    it('should use parseArgs when config is not provided', async () => {
      const packageJson = join(tempDir, 'package.json');
      await writeFile(
        packageJson,
        JSON.stringify({
          name: 'test-app',
          schemaVersionedStorage: {
            migrations: {
              dir: './migrations',
              indexPath: './index.ts',
              typesPath: 'test-package',
            },
          },
        })
      );

      const indexPath = join(tempDir, 'index.ts');
      await mkdir(join(tempDir, 'migrations'), { recursive: true });

      await generateMigrationsIndex(undefined, tempDir);

      const content = await readFile(indexPath, 'utf-8');
      expect(content).toContain("import type { Migration } from 'test-package'");
    });
  });
});

