# Publishing Guide

## Pre-Publishing Checklist

### 1. Verify Package Configuration
- [x] `package.json` has correct name, version, and description
- [x] `package.json` includes all necessary fields (main, types, module, exports)
- [x] `package.json` has correct dependencies and peerDependencies
- [x] `package.json` `files` field includes all necessary files

### 2. Build and Test
- [x] Run `npm run build` - should complete without errors
- [x] Run `npm run test` - all tests should pass
- [x] Run `npm run type-check` - no TypeScript errors
- [x] Run `npm run test:coverage` - verify coverage is acceptable

### 3. Verify Files to Publish
- [x] `dist/` directory exists and contains built files
- [x] `scripts/` directory is included (for generation scripts)
- [x] `templates/` directory is included
- [x] `README.md` is up to date
- [x] `LICENSE` file exists
- [x] `CHANGELOG.md` is updated

### 4. Check .npmignore
- [x] Source files (`src/`) are excluded
- [x] Test files are excluded
- [x] Development config files are excluded
- [x] `scripts/` directory is NOT excluded (needed by consumers)

### 5. Verify Package Contents
Run `npm pack --dry-run` to see what will be published:
```bash
npm pack --dry-run
```

This will show you exactly what files will be included in the package.

## Publishing Steps

### Option 1: Manual Publishing (Recommended for first release)

1. **Login to npm** (if not already logged in):
   ```bash
   npm login
   ```

2. **Verify you're logged in**:
   ```bash
   npm whoami
   ```

3. **Test the package locally** (optional but recommended):
   ```bash
   npm pack
   # This creates a .tgz file you can test locally
   ```

4. **Publish to npm**:
   ```bash
   npm publish --access public
   ```
   
   Note: Use `--access public` for scoped packages or to explicitly make it public.

5. **Verify publication**:
   - Check https://www.npmjs.com/package/schema-versioned-storage
   - Try installing: `npm install schema-versioned-storage`

### Option 2: Automated Publishing via GitHub Release

1. **Update version in package.json**:
   ```bash
   npm version patch  # or minor, or major
   ```

2. **Commit and push**:
   ```bash
   git add package.json package-lock.json
   git commit -m "chore: bump version to X.Y.Z"
   git push
   ```

3. **Create a GitHub Release**:
   - Go to your repository on GitHub
   - Click "Releases" → "Create a new release"
   - Choose the tag (e.g., `v0.1.0`)
   - Fill in release title and description (copy from CHANGELOG.md)
   - Click "Publish release"

4. **GitHub Action will automatically**:
   - Verify version matches release tag
   - Run tests
   - Build the package
   - Publish to npm

### Setup Required for Automated Publishing

Before the first automated release, you need to:

1. **Create an npm access token**:
   - Go to https://www.npmjs.com/
   - Click your profile → "Access Tokens"
   - Generate new token → Choose "Automation" type
   - Copy the token

2. **Add token as GitHub secret**:
   - Go to your repository → Settings → Secrets and variables → Actions
   - Click "New repository secret"
   - Name: `NPM_TOKEN`
   - Value: Your npm access token
   - Click "Add secret"

## Post-Publishing

1. **Verify the package on npm**:
   - Visit https://www.npmjs.com/package/schema-versioned-storage
   - Check that all files are included
   - Verify the README displays correctly

2. **Test installation**:
   ```bash
   mkdir test-install
   cd test-install
   npm init -y
   npm install schema-versioned-storage
   # Verify it works
   ```

3. **Update documentation** (if needed):
   - Add installation instructions to README if missing
   - Update any version-specific notes

## Version Bumping

For future releases, use semantic versioning:

- **Patch** (0.1.0 → 0.1.1): Bug fixes
  ```bash
  npm version patch
  ```

- **Minor** (0.1.0 → 0.2.0): New features, backward compatible
  ```bash
  npm version minor
  ```

- **Major** (0.1.0 → 1.0.0): Breaking changes
  ```bash
  npm version major
  ```

Then update CHANGELOG.md and create a GitHub release.

## Current Status

✅ Package is ready for publishing:
- Version: 0.1.0
- Build: ✅ Passing
- Tests: ✅ 186 tests passing
- Type checking: ✅ No errors
- Coverage: ✅ 97.25% overall, 100% for core modules
- Documentation: ✅ Complete
- License: ✅ MIT
- CI/CD: ✅ Configured

## Next Steps

1. Run `npm pack --dry-run` to verify package contents
2. If everything looks good, run `npm publish --access public`
3. Or create a GitHub release to trigger automated publishing

