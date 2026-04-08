# NPM Publishing Setup with 2FA

This document explains how to set up automated NPM publishing with GitHub Actions and 2FA support.

## Prerequisites

- GitHub repository with admin access
- NPM account with 2FA enabled
- Granular Access Token from NPM (recommended)

## Step 1: Create NPM Granular Access Token

NPM recommends **Granular Access Tokens** over classic tokens for better security.

### Create Token in NPM:

1. Go to [npmjs.com](https://www.npmjs.com)
2. Login to your account
3. Click **Profile** → **Access Tokens**
4. Click **Generate new token** → Choose **Granular Access Token**

**Token Permissions (Minimal):**

- ✅ **Publish** - Allow publish to registry
- ✅ **Read and write** scopes
- ✅ **No expiration** (or set to 1 year)
- ✅ Restrict to package: `opencodekit-cli`

**Copy the token** (you won't see it again)

### Why Granular Token?

- Works with 2FA enabled ✅
- Scoped to specific packages ✅
- Can be revoked easily ✅
- Better security than classic tokens ✅

## Step 2: Add GitHub Secret

GitHub Actions automatically uses `GITHUB_TOKEN`, but needs `NPM_TOKEN` for publishing.

### Create GitHub Secret:

1. Go to your GitHub repo
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Name: `NPM_TOKEN`
5. Value: Paste your NPM Granular Access Token
6. Click **Add secret**

### Verify:

```bash
# In GitHub Actions logs, secrets are masked
* npm publish
  Publishing to registry...
  npm notice publishing @opencodecai/opencodekit-cli@0.1.0
```

## Step 3: Add Discord Webhook (Optional)

For release notifications:

1. Create Discord webhook in your server
2. Go to **Settings** → **Secrets and variables** → **Actions**
3. Add secret: `DISCORD_WEBHOOK_URL`

## How It Works

### Release Workflow (`.github/workflows/release.yml`)

**Triggered on:** Push to main branch

**Steps:**

1. **Build binaries** - Cross-platform compilation (4 platforms)
   - macOS ARM64
   - macOS x64
   - Linux x64
   - Windows x64

2. **Quality gates** - Type check, linting, tests

3. **Semantic versioning** - Automatic version bump based on commits
   - `fix:` → patch version (0.1.0 → 0.1.1)
   - `feat:` → minor version (0.1.0 → 0.2.0)
   - `BREAKING CHANGE:` → major version (0.1.0 → 1.0.0)

4. **NPM publish** - Push to npm registry with `NPM_TOKEN`
   - Works with 2FA ✅
   - Granular token scoped to package ✅

5. **GitHub release** - Create release with binaries
   - Attach compiled binaries
   - Generate changelog

6. **Discord notification** - Announce release

### Semantic Release Config (`.releaserc.json`)

```json
{
  "plugins": [
    "@semantic-release/commit-analyzer", // Analyze commits
    "@semantic-release/release-notes-generator", // Generate changelog
    "@semantic-release/changelog", // Update CHANGELOG.md
    "@semantic-release/npm", // Publish to npm
    "@semantic-release/git", // Push version bumps
    "@semantic-release/github" // Create GitHub release
  ]
}
```

## Publishing Manually (if needed)

```bash
# Build
bun run build
bun run compile:binary

# Test (dry run)
npx semantic-release --dry-run

# Publish (with 2FA prompt)
npx semantic-release
```

## Troubleshooting

### "403 Forbidden" on NPM publish

**Cause:** Invalid or expired NPM token

**Fix:**

1. Generate new Granular Access Token in NPM
2. Update GitHub secret: `NPM_TOKEN`
3. Retry release

### "Requires authentication" error

**Cause:** Token not passed to semantic-release

**Fix:**

1. Verify `NPM_TOKEN` secret exists in GitHub
2. Check workflow has `NPM_TOKEN: ${{ secrets.NPM_TOKEN }}`
3. Ensure token has **Publish** permission

### 2FA timeout

**Cause:** Granular token not configured

**Fix:**

1. Use Granular Access Token (not classic)
2. Ensure token has no expiration or far future expiration
3. Verify scopes include **Publish**

### Binaries not included in release

**Cause:** Build step failed

**Fix:**

1. Check `.github/workflows/build-binaries.yml` runs successfully
2. Verify artifacts uploaded
3. Check `bin/` directory has compiled binaries

## GitHub Actions Secrets Summary

| Secret                | Source                         | Required |
| --------------------- | ------------------------------ | -------- |
| `NPM_TOKEN`           | NPM → Access Tokens → Granular | ✅ Yes   |
| `GITHUB_TOKEN`        | Auto-provided by GitHub        | ✅ Yes   |
| `DISCORD_WEBHOOK_URL` | Discord Server Settings        | ❌ No    |

## Commit Messages for Releases

Semantic Release reads commit messages to determine version:

```bash
# Patch release (0.1.0 → 0.1.1)
git commit -m "fix: resolve CLI initialization issue"

# Minor release (0.1.0 → 0.2.0)
git commit -m "feat: add new skill command"

# Major release (0.1.0 → 1.0.0)
git commit -m "feat: redesign CLI interface

BREAKING CHANGE: old command syntax no longer supported"
```

## Testing the Workflow

1. Make a test commit with `feat: test feature`
2. Push to main branch
3. Go to **Actions** tab in GitHub
4. Watch the **Release** workflow
5. Check NPM package page when done: `npm.js/package/opencodekit-cli`

## Security Best Practices

- ✅ Use Granular Access Token (not classic)
- ✅ Scope token to single package
- ✅ Rotate tokens annually
- ✅ Delete tokens after use if temporary
- ✅ Monitor secret access in GitHub audit log
- ✅ Use branch protection rules for main

## References

- [Semantic Release Docs](https://semantic-release.gitbook.io/)
- [NPM Granular Access Tokens](https://docs.npmjs.com/about-access-tokens)
- [GitHub Actions Secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
