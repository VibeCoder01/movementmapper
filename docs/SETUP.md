# Movement Mapper Setup Guide

## 1. Hardware Setup
1.  **Tapo H100 Hub**: Plug in the hub and set it up using the Tapo app.
2.  **Tapo T100 Sensors**: Pair your PIR sensors with the H100 hub using the Tapo app.
3.  **Enable Matter**: In the Tapo app, go to the H100 hub settings and enable Matter/Bind to Matter. Note the pairing code.

## 2. Matter Server Setup
This project requires a running Matter Server. The recommended way is to use the official Python Matter Server via Docker.

### Installing Docker (Convenience Script)
If you don't have Docker installed, you can use the official convenience script:
```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
# Log out and back in, or run:
newgrp docker
```

### Running the Server
Once Docker is ready:
```bash
docker run -d \
  --name matter-server \
  --restart=unless-stopped \
  --net=host \
  -v $(pwd)/matter_data:/data \
  ghcr.io/home-assistant-libs/python-matter-server:stable
```
*Note: `--net=host` is required for mDNS discovery.*

Alternatively, you can run it directly if you have the dependencies installed using the provided script:
```bash
./run_matter_server.sh
```

> [!WARNING]
> If you encounter `CHIP handle has not been initialized!` or core dumps when running locally, it indicates an incompatibility with your system libraries. In this case, **you must use the Docker method** or run the Matter Server on a different machine (e.g., Raspberry Pi).

If running on a different machine, update the `MATTER_SERVER_URL` environment variable in the backend:
```bash
export MATTER_SERVER_URL="ws://<IP_ADDRESS>:5580/ws"
```

## 3. Backend Setup
1.  Navigate to the `backend` directory.
2.  Create a virtual environment (optional but recommended):
    ```bash
    python3 -m venv venv
    source venv/bin/activate
    ```
3.  Install dependencies:
    ```bash
    pip install -r requirements.txt
    ```
4.  Run the backend server:
    ```bash
    uvicorn main:app --reload --host 0.0.0.0 --port 8000
    ```

## 4. Frontend Setup
1.  Navigate to the `frontend` directory.
2.  Install Node.js (if not already installed).
3.  Install dependencies:
    ```bash
    npm install
    ```
4.  Run the development server:
    ```bash
    npm run dev
    ```
5.  Open your browser to `http://localhost:5173`.

## 5. Pairing the Hub
1.  Once the Matter Server and Backend are running, you need to pair the Tapo H100 hub to the Matter Server.
2.  You can use the Matter Server's CLI or UI (if available) to commission the device using the pairing code from Step 1.
3.  Once paired, the `matter_client.py` in the backend will automatically detect the sensors and start logging activity.

## 6. Using the Dashboard
- The dashboard will show a list of detected sensors.
- **Activity Graph**: Shows activity events over time.
- **Heatmap**: Shows activity intensity by hour and day.
- **Anomalies**: The system analyzes patterns and flags unusual activity. You can trigger analysis manually via the "Run Analysis" button.
