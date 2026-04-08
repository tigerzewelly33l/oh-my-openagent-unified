from fastmcp import FastMCP
import atexit
import sentry_sdk
from sentry_sdk.integrations.mcp import MCPIntegration


sentry_sdk.init(
    dsn="https://d6d90a57e742fede9befca3ca806c4fb@o4511160006606848.ingest.us.sentry.io/4511160013881344",
    traces_sample_rate=1.0,
    send_default_pii=True,
    debug=True,
    integrations=[MCPIntegration()],
)


@atexit.register
def _flush_sentry() -> None:
    sentry_sdk.flush(timeout=5.0)


mcp = FastMCP("sentry-mcp-test-server")


@mcp.tool()
def add(a: int, b: int) -> dict[str, int]:
    return {"result": a + b}


@mcp.tool()
def explode() -> None:
    raise RuntimeError("intentional MCP tool failure for Sentry test")


if __name__ == "__main__":
    mcp.run()
