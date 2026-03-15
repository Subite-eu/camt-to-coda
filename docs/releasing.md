# Releasing a New Version

## Prerequisites

- All changes committed and pushed to `main`
- CI passing on `main` (green build badge)
- `CHANGELOG.md` updated with the new version's changes

## Step-by-Step

### 1. Update version numbers

```bash
# Update version in parent POM
# java/BankFileConverter/pom.xml → <version>X.Y.Z</version>

# Update version in CLI
# CamtToCoda/src/main/java/eu/subite/cli/CamtToCodaCli.java → version = "camt2coda X.Y.Z"

# Update CHANGELOG.md — rename [Unreleased] to [X.Y.Z] - YYYY-MM-DD
```

### 2. Commit version bump

```bash
git add -A
git commit -m "Release vX.Y.Z"
git push origin main
```

### 3. Wait for CI to pass

Check: https://github.com/Subite-eu/camt-to-coda/actions

### 4. Create and push a tag

```bash
git tag -a vX.Y.Z -m "Release vX.Y.Z"
git push origin vX.Y.Z
```

This triggers the **release workflow** (`.github/workflows/release.yml`) which:
- Builds distribution archives for linux-x64 and macos-arm64
- Creates a GitHub Release with auto-generated release notes
- Attaches the build artifacts

### 5. Verify the release

- Go to https://github.com/Subite-eu/camt-to-coda/releases
- Confirm the release was created with the correct tag
- Confirm artifacts are attached
- Confirm release notes look correct (edit if needed)

### 6. Docker image

The Docker image is automatically pushed to `ghcr.io` on every push to `main`:

```bash
docker pull ghcr.io/subite-eu/camt-to-coda:main
```

For tagged releases, the image is also tagged with the version:

```bash
docker pull ghcr.io/subite-eu/camt-to-coda:vX.Y.Z
```

## Version Numbering

Follow [Semantic Versioning](https://semver.org/):

- **MAJOR** (X): Breaking changes to CLI interface, CODA output format changes
- **MINOR** (Y): New features (new CAMT version support, new CLI commands)
- **PATCH** (Z): Bug fixes, documentation updates

## First Release Checklist

For the very first public release:

- [ ] Change repo visibility to **Public** on GitHub (Settings → Danger Zone)
- [ ] Verify the README badge URLs work with the public repo
- [ ] Create `v1.0.0` tag and push
- [ ] Verify GitHub Actions runs successfully on the public repo
- [ ] Verify Docker image is publicly pullable
- [ ] Consider adding a LICENSE file if not present
