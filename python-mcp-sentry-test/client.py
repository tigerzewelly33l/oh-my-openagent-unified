import asyncio

from fastmcp import Client


async def main() -> None:
    client = Client("server.py")

    async with client:
        add_result = await client.call_tool("add", {"a": 2, "b": 3})
        print("add_result", add_result)

        try:
            await client.call_tool("explode", {})
        except Exception as error:
            print("explode_error", error)


if __name__ == "__main__":
    asyncio.run(main())
