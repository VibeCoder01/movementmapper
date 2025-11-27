import asyncio
import aiohttp
from matter_server.client import MatterClient

async def main():
    async with aiohttp.ClientSession() as session:
        client = MatterClient("ws://localhost:5580/ws", session)
        print(help(client.commission_with_code))

if __name__ == "__main__":
    asyncio.run(main())
