# Releasing a New Version

## Prerequisites

- All changes committed and pushed to `main`
- CI passing on `main` (green build badge)
- `CHANGELOG.md` updated with the new version's changes

## Step-by-Step

### 1. Update version numbers

```bash
# Update version in package.json
npm version patch   # or minor / major

# Update CHANGELOG.md — rename [Unreleased] to [X.Y.Z] - YYYY-MM-DD
```

`npm version` automatically:
- Bumps the version in `package.json`
- Creates a git commit (`"X.Y.Z"`)
- Creates a git tag (`vX.Y.Z`)

### 2. Push the commit and tag

```bash
git push origin main
git push origin vX.Y.Z
```

### 3. Wait for CI to pass

Check: https://github.com/Subite-eu/camt-to-coda/actions

### 4. Verify the release

Pushing the tag triggers the **release workflow** (`.github/workflows/build-push-action.yml`) which:
- Runs all tests (`npx vitest run`)
- Builds the TypeScript project (`npm run build`)
- Packages a distribution archive
- Creates a GitHub Release with auto-generated release notes
- Attaches build artifacts to the release
- Pushes the Docker image to `ghcr.io` tagged with both `main` and `vX.Y.Z`

Go to https://github.com/Subite-eu/camt-to-coda/releases and confirm:
- The release was created with the correct tag
- Artifacts are attached
- Release notes look correct (edit if needed)

### 5. Docker image

The Docker image is automatically pushed to `ghcr.io` on every push to `main`:

```bash
docker pull ghcr.io/subite-eu/camt-to-coda:main
```

For tagged releases, the image is also tagged with the version:

```bash
docker pull ghcr.io/subite-eu/camt-to-coda:vX.Y.Z
```

### 6. npm package (optional)

If you want to publish to the npm registry:

```bash
npm publish --access public
```

Requires an npm account with publish rights to the `camt2coda` package.

## Version Numbering

Follow [Semantic Versioning](https://semver.org/):

- **MAJOR** (X): Breaking changes to CLI interface or CODA output format
- **MINOR** (Y): New features (new CAMT version support, new CLI subcommands)
- **PATCH** (Z): Bug fixes, documentation updates

## Release Checklist

- [ ] `CHANGELOG.md` has an entry for the new version
- [ ] `package.json` version matches the intended tag
- [ ] All tests pass locally: `npm test`
- [ ] TypeScript compiles cleanly: `npm run typecheck`
- [ ] Docker build passes locally: `docker build .`
- [ ] README badges point to the correct repo URLs
