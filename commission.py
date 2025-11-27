import asyncio
import aiohttp
import sys
import logging
from matter_server.client import MatterClient

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

MATTER_SERVER_URL = "ws://localhost:5580/ws"

async def main():
    if len(sys.argv) < 2:
        print("Usage: python commission.py <PAIRING_CODE> [--network-only]")
        sys.exit(1)

    code = sys.argv[1]
    network_only = "--network-only" in sys.argv
    
    logger.info(f"Connecting to Matter Server at {MATTER_SERVER_URL}...")
    async with aiohttp.ClientSession() as session:
        async with MatterClient(MATTER_SERVER_URL, session) as client:
            logger.info("Connected. Starting commissioning...")
            logger.info(f"Network only mode: {network_only}")
            try:
                node = await client.commission_with_code(code, network_only=network_only)
                logger.info(f"Successfully commissioned node: {node}")
            except Exception as e:
                logger.error(f"Commissioning failed: {e}")
                import traceback
                traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())
