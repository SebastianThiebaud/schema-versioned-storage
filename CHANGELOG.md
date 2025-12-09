# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.1] - 2025-12-09

### Fixed
- Removed incorrectly generated migrations index file from library source code
  - The `src/migrations/index.ts` file was auto-generated and should only exist in user projects, not in the library itself
  - This fixes TypeScript compilation errors when building the library

## [0.2.0] - 2025-12-09

### Added
- **React Hooks Support**: New optional React integration for easier state access
  - `StorageProvider` component to provide storage instance via React Context
  - `useStorage<TSchema>()` hook to access storage from any component
  - `useStorageInitialized()` hook to check initialization status
  - Available at `@sebastianthiebaud/schema-versioned-storage/react`
  - React is an optional peer dependency (16.8+)
  - Full TypeScript support with type safety
- **GitHub Packages Publishing**: Package now publishes to GitHub Packages
  - Scoped package name: `@sebastianthiebaud/schema-versioned-storage`
  - Configured `.npmrc` and `publishConfig` for GitHub Packages
  - Updated GitHub Actions workflow for GitHub Packages publishing
- **Enhanced Documentation**:
  - Added "Why This Package?" section with type-safe examples
  - React hooks usage guide and examples
  - Updated all examples to use scoped package name
  - Improved installation instructions

### Changed
- **Package Name**: Changed from `schema-versioned-storage` to `@sebastianthiebaud/schema-versioned-storage`
  - All imports now use scoped package name
  - Migration generation scripts automatically use package name from `package.json`
  - Updated all documentation and examples
- **Installation**: Zod is now automatically installed (no need to install separately)
  - Updated README to reflect automatic dependency installation
  - Changed feature description from "Zero dependencies" to "Minimal dependencies"
- **Script Paths**: All examples now use `svs` CLI tool instead of direct node commands
  - Cleaner and more maintainable script references
  - Updated README with `svs` usage throughout

### Fixed
- TypeScript errors in migration index generation when using scoped package names
- Package name references in generated migration files now use actual package name from `package.json`
- Test suite updated to work with scoped package names

## [0.1.2] - 2025-12-09

### Added
- CLI tool (`svs`) for running generation scripts
  - `svs generate:migrations` - Generate migrations index
  - `svs generate:schema-hashes` - Generate schema hashes
  - `svs generate:all` - Generate both
  - Automatically installed when package is installed

## [0.1.1] - 2025-12-09

### Fixed
- AsyncStorage adapter now supports both v1.x and v2.x of `@react-native-async-storage/async-storage`
- Improved error handling and validation in AsyncStorage adapter to handle different export patterns

## [0.1.0] - 2024-12-09

### Added
- Initial release
- Core persistence logic with type-safe state management using Zod schemas
- Migration system for automatic schema versioning and data migration
- Storage adapters for React Native (AsyncStorage), Web (localStorage), and testing (Memory)
- Schema hash utilities for change detection and validation
- Generation scripts for migrations index and schema hashes
- Comprehensive TypeScript types with full type safety
- Configurable paths for schema, defaults, and migrations via:
  - CLI arguments
  - Config file (JSON, nested or flat format)
  - package.json configuration (`schemaVersionedStorage` field)
- Testable script modules in `scripts/lib/` with unit tests
- Comprehensive test suite with 100% coverage for core modules
- Integration tests for script execution
- GitHub Actions workflows for CI/CD and automated npm publishing
- Full documentation with examples and API reference
- Template files for schema, defaults, migrations, and configuration
- Example usage files for basic and React Native scenarios

### Features
- **Type-safe state management**: Full TypeScript support with Zod schema validation
- **Automatic migrations**: Seamlessly migrate between schema versions
- **Storage agnostic**: Works with any storage backend via adapter interface
- **Zero dependencies**: Only requires Zod (and optional peer dependencies for adapters)
- **Test-friendly**: Includes memory adapter for testing
- **Tree-shakeable**: ES modules support
- **100% test coverage**: Core modules fully tested
- **CI/CD ready**: Automated testing and publishing workflows

