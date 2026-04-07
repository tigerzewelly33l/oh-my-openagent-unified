# Release Notes v0.15.20

## Claude Reasoning Support for GitHub Copilot

This release adds **extended thinking/reasoning support** for Claude models accessed through the GitHub Copilot provider.

### Features

#### Claude Reasoning via Copilot API

- **Automatic `thinking_budget` injection**: When using Claude models (claude-sonnet-4.5, claude-opus-4.5, claude-haiku-4.5) through GitHub Copilot, the plugin automatically adds `thinking_budget` to requests
- **Response transformation**: Parses `reasoning_text` from Copilot API responses and converts it to the standard `reasoning` field that OpenCode's AI SDK understands
- **Streaming support**: Full support for both streaming (SSE) and non-streaming responses
- **Configurable budget**: Default thinking budget is 10,000 tokens, configurable per-model in `opencode.json`

#### Improved Logging

- Replaced `console.log` with proper OpenCode plugin logging via `client.app.log()`
- Logs now appear in the TUI log panel instead of polluting the input area
- Structured logging with service name, levels (debug/info/warn/error), and extra metadata

### Configuration

Configure thinking budget in `.opencode/opencode.json`:

```json
{
  "provider": {
    "github-copilot": {
      "models": {
        "claude-sonnet-4.5": {
          "reasoning": true,
          "options": {
            "thinking_budget": 10000
          },
          "variants": {
            "high": {
              "options": { "thinking_budget": 8000 }
            },
            "max": {
              "options": { "thinking_budget": 16000 }
            }
          }
        }
      }
    }
  }
}
```

### Technical Details

- Added SSE stream transformation to parse `reasoning_text` from each chunk
- Response transformation converts Copilot's `reasoning_text` field to standard `reasoning` string
- Custom SDK files added to `.opencode/plugins/sdk/copilot/` (ported from OpenCode upstream)
- Fetch wrapper modified to inject `thinking_budget` and transform responses for Claude models

### Files Changed

- `.opencode/plugins/copilot-auth.ts` - Added reasoning support and proper logging
- `.opencode/plugins/sdk/copilot/` - New custom SDK directory (11 files)
- `.opencode/opencode.json` - Updated Claude model configs with thinking_budget

---

**Full Changelog**: https://github.com/opencodekit/opencodekit-template/compare/v0.15.19...v0.15.20
