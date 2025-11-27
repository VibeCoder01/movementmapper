#!/bin/bash
source venv/bin/activate
python3 -m matter_server.server \
    --storage-path $(pwd)/matter_data \
    --vendorid 65521 \
    --port 5580
