# Releasing a new version

## Prepare and review

Start from current `main`. Update the version without prematurely creating a release tag:

```bash
npm version patch --no-git-tag-version   # or minor / major
```

This updates `package.json` and `package-lock.json`. Also update the CLI's `.version(...)` in `src/cli.ts`, which currently declares its version separately. Move `[Unreleased]` changes into `[X.Y.Z] - YYYY-MM-DD` in [CHANGELOG.md](../CHANGELOG.md), leaving a new Unreleased section for future changes.

Build and verify using the [contributor guide](../CONTRIBUTING.md). Submit the version, changelog and documentation changes through a reviewed PR. Wait for all required CI checks, merge, and verify the merged main commit's checks before tagging it.

## Tag the reviewed main commit

After fetching and fast-forwarding a clean local `main` to the intended release commit, replace `X.Y.Z` with its actual version:

```bash
git tag -a vX.Y.Z -m "Release X.Y.Z"
git push origin vX.Y.Z
```

Pushing a `v*` tag starts [release.yml](../.github/workflows/release.yml). Its `validate` job calls the reusable [build workflow](../.github/workflows/build-push-action.yml): Node 22/24 builds/coverage, public examples and XSDs, four browser projects, dependency audit, live MinIO and Docker CLI/web smoke checks. The release job depends on that validation succeeding.

## What automation publishes

The release job builds a Docker image for `linux/amd64` and `linux/arm64`, including both the compiled CLI/server and browser app. It publishes:

- `ghcr.io/subite-eu/camt-to-coda:vX.Y.Z`
- `ghcr.io/subite-eu/camt-to-coda:latest`
- A GitHub Release with generated notes and installation instructions.

There is currently **no automated npm publication, distribution archive, or attached build artifact** on the GitHub Release. The build workflow separately publishes `:main` after passing checks on a main push; a release tag does not retag `:main`. Coverage and browser reports are workflow artifacts, rather than release downloads.

Inspect the [Actions run](https://github.com/Subite-eu/camt-to-coda/actions), [GitHub Release](https://github.com/Subite-eu/camt-to-coda/releases), image tags and both supported image platforms. Smoke-test the versioned image:

```bash
docker pull ghcr.io/subite-eu/camt-to-coda:vX.Y.Z
docker run --rm ghcr.io/subite-eu/camt-to-coda:vX.Y.Z --version
docker run --rm -p 3000:3000 ghcr.io/subite-eu/camt-to-coda:vX.Y.Z serve --host 0.0.0.0
```

The hosted static web apps use the Cloudflare Pages Git integration described in the [README](../README.md). A green Docker release is not proof that a hosted domain serves the same assets. For hosted changes, run the remote browser suite and `scripts/verify-deployment.mjs` from the intended build as described in [Contributing](../CONTRIBUTING.md).

## Version policy and checklist

Use a major version for incompatible CLI or conversion behavior, a minor version for compatible features, and a patch version for compatible fixes. Assess changes to bank-format interpretation carefully even when the CLI interface is unchanged.

- [ ] Package, lockfile, CLI version and intended tag agree.
- [ ] Changelog and current feature/limitation guides match the release.
- [ ] Reviewed release preparation PR and merged main checks are green.
- [ ] Tag points to that reviewed commit; tagged validation and publication succeed.
- [ ] GitHub Release notes and versioned multi-platform image are verified.
- [ ] Hosted deployment is separately verified if its app assets changed.

Publishing to npm would be a separate maintainer action requiring package rights and a package-content review. The current release workflow does not establish npm availability, so installation guides use Docker or a source checkout.
