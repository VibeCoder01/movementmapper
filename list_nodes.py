import asyncio
import aiohttp
from matter_server.client import MatterClient

async def list_nodes():
    async with aiohttp.ClientSession() as session:
        async with MatterClient('ws://localhost:5580/ws', session) as client:
            nodes = client.get_nodes()
            print(f'Commissioned nodes: {len(nodes)}')
            if len(nodes) == 0:
                print('No nodes commissioned yet.')
            else:
                for node in nodes:
                    print(f'\nNode {node.node_id}:')
                    print(f'  Available: {node.available}')
                    if hasattr(node, 'endpoints'):
                        print(f'  Endpoints: {node.endpoints}')

asyncio.run(list_nodes())
