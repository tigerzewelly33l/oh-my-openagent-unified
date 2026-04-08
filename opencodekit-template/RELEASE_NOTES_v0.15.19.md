# Release v0.15.19 - GitHub Copilot Claude Stability Fix

## 🐛 Bug Fix: GitHub Copilot Claude Model Stability

This patch release fixes critical stability issues with Claude models through GitHub Copilot provider, restoring reliable API access while maintaining backwards compatibility.

## ✨ What's Fixed

### GitHub Copilot Claude Authentication

**Problem:**

- Claude models (haiku, opus, sonnet) were returning "404 Not Found" errors when used through GitHub Copilot provider
- Attempted routing to native Anthropic `/v1/messages` endpoint failed
- Reasoning features couldn't be enabled without breaking stability

**Solution:**

- Reverted to stable OpenAI-compatible endpoint configuration
- All Copilot models (including Claude) now use `@ai-sdk/github-copilot` SDK
- All models routed through `/v1/chat/completions` endpoint
- Restored from working commit `f7aabde`

### Changes in `.opencode/plugins/copilot-auth.ts`

```typescript
// Before (broken):
const isClaude = model.id.includes("claude");
let url = base;
if (isClaude) {
  if (!url.endsWith("/v1")) {
    url = url.endsWith("/") ? `${url}v1` : `${url}/v1`;
  }
}
model.api.url = url;
model.api.npm = isClaude ? "@ai-sdk/anthropic" : "@ai-sdk/github-copilot";

// After (stable):
// Claude routing disabled - all models use github-copilot SDK
model.api.npm = "@ai-sdk/github-copilot";
```

## ✅ What Works Now

- ✅ Claude haiku 4.5 - reliable, working
- ✅ Claude opus 4.5 - reliable, working
- ✅ Claude sonnet 4.5 - reliable, working
- ✅ All other Copilot models - working as before
- ✅ No "404 Not Found" errors
- ✅ Vision requests supported
- ✅ Tool use supported

## ⚠️ Known Limitations

- Claude models work through OpenAI-compatible API, not native Anthropic SDK
- Reasoning features not enabled (would require GitHub Copilot reasoning gateway research)
- Future versions can add reasoning once GitHub Copilot endpoints are documented

## 📊 Testing

- ✅ TypeScript type checking passed
- ✅ Linting passed (0 warnings)
- ✅ Manual testing: Claude haiku 4.5 confirmed working
- ✅ Manual testing: Claude opus 4.5 confirmed working

## 📝 Migration Notes

**For users on v0.15.18:**

If you experienced "404 Not Found" errors with Claude models:

1. Upgrade to v0.15.19
2. Restart OpenCode
3. Claude models will work immediately - no reconfiguration needed

## 🔮 Future Roadmap

To enable reasoning features for Claude models:

1. Research GitHub Copilot's reasoning gateway endpoints
2. Document the `/v1/reasoning` or similar endpoint
3. Implement conditional routing based on model capabilities
4. Add reasoning budget configuration

## 🙏 Thanks

Thanks to the user for reporting the 404 errors and working through the debugging process!

---

**Full Changelog**: https://github.com/opencodekit/opencodekit-template/compare/v0.15.18...v0.15.19

**Commits:**

- `1050e32` - fix(copilot-auth): restore stable version with disabled claude routing
