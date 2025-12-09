# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

