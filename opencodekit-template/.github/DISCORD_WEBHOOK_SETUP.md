# Discord Webhook Setup Guide

## Overview

This repository is configured to send Discord notifications when code is pushed to `main` or `develop` branches, or when pull requests are opened/merged.

---

## Step 1: Create Discord Webhook

### In Discord:

1. **Open your Discord server**
2. **Go to Server Settings** → **Integrations** → **Webhooks**
3. **Click "New Webhook"** or **"Create Webhook"**
4. **Configure the webhook:**
   - Name: `GitHub Notifications` (or any name you prefer)
   - Channel: Select the channel where notifications will appear (e.g., `#github-updates`)
   - Avatar: Optional (you can use GitHub logo)
5. **Click "Copy Webhook URL"** - Save this for Step 2

---

## Step 2: Add Webhook to GitHub Secrets

### In GitHub Repository:

1. **Go to your repository**: `https://github.com/opencodekit/opencodekit-template`
2. **Navigate to**: **Settings** → **Secrets and variables** → **Actions**
3. **Click "New repository secret"**
4. **Add the secret:**
   - Name: `DISCORD_WEBHOOK_URL`
   - Value: Paste the webhook URL you copied from Discord
   - Example: `https://discord.com/api/webhooks/1234567890/AbCdEfGhIjKlMnOpQrStUvWxYz`
5. **Click "Add secret"**

---

## Step 3: Test the Workflow

### Push a commit to test:

```bash
# Make a small change
echo "# Test Discord Webhook" >> TEST.md

# Commit and push
git add TEST.md
git commit -m "test: verify Discord webhook integration"
git push origin main
```

### What you should see in Discord:

A message with:

- 🚀 Title: "New Push to `main`"
- Commit message
- Author name
- Commit hash (clickable link)
- Files changed count
- List of modified files

---

## Step 4: Customize (Optional)

### Change notification trigger branches:

Edit `.github/workflows/discord-notification.yml`:

```yaml
on:
  push:
    branches:
      - main # ← Add/remove branches here
      - develop
      - feature/* # ← Wildcards supported
```

### Change embed colors:

```yaml
"color": 3447003  # Blue for push
"color": 15844367 # Orange for PR opened
"color": 5763719  # Green for PR merged
```

Color reference:

- Blue: `3447003`
- Green: `5763719`
- Red: `15158332`
- Orange: `15844367`
- Purple: `10181046`

### Change notification format:

Edit the `embeds` section in the workflow file to customize:

- Title
- Description
- Fields (add/remove information)
- Footer text
- Emoji icons

---

## Notification Types

### 1. Push Notification

**Triggers:** Code pushed to `main` or `develop`  
**Contains:**

- Commit message
- Author
- Commit hash (link to GitHub)
- Files changed count
- List of modified files (max 5)

### 2. Pull Request Opened

**Triggers:** New PR created  
**Contains:**

- PR title
- Author
- Source → Target branch
- Link to PR

### 3. Pull Request Merged

**Triggers:** PR merged to base branch  
**Contains:**

- PR title
- Merged by (user)
- Source → Target branch
- Link to PR

---

## Troubleshooting

### "Workflow not running"

- Check that webhook secret is named exactly: `DISCORD_WEBHOOK_URL`
- Verify workflow file is in: `.github/workflows/discord-notification.yml`
- Check GitHub Actions tab for errors

### "No message in Discord"

- Verify webhook URL is correct
- Check webhook channel permissions (bot can send messages)
- Test webhook manually:
  ```bash
  curl -H "Content-Type: application/json" \
       -X POST \
       -d '{"content": "Test message"}' \
       "YOUR_WEBHOOK_URL_HERE"
  ```

### "Workflow failed"

- Go to: **Actions** tab in GitHub repository
- Click on failed workflow run
- Check logs for error details

---

## Security Notes

1. **Never commit webhook URLs to git**
   - Webhooks are stored in GitHub Secrets (encrypted)
   - Anyone with webhook URL can send messages to your Discord

2. **Rotate webhook if compromised:**
   - Discord: Server Settings → Webhooks → Delete old webhook
   - Create new webhook
   - Update `DISCORD_WEBHOOK_URL` secret in GitHub

3. **Limit workflow permissions:**
   - Workflow only has read access to repository
   - No write permissions needed

---

## Example Discord Message

```
🚀 New Push to `main`
docs: update README to reflect manual handoff workflow only

👤 Author: John Doe
📝 Commit: a1b2c3d
📂 Files Changed: 3 files

📄 Modified Files:
• README.md
• .opencode/README.md
• .opencode/.env.example

OpenCodeKit Template • Today at 3:45 PM
```

---

## Resources

- [Discord Webhooks Guide](https://support.discord.com/hc/en-us/articles/228383668-Intro-to-Webhooks)
- [GitHub Actions Secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- [GitHub Actions Workflow Syntax](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions)

---

**Setup complete!** Your Discord channel will now receive notifications for all pushes and pull requests.
