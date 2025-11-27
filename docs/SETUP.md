# Movement Mapper Setup Guide

## 1. Hardware Setup
1.  **Tapo H100 Hub**: Plug in the hub and set it up using the Tapo app.
2.  **Tapo T100 Sensors**: Pair your PIR sensors with the H100 hub using the Tapo app.
3.  **Note the Hub's IP Address**: You'll need this for configuration (find it in your router or Tapo app).

## 2. Backend Setup
1.  Create a virtual environment (recommended):
    ```bash
    python3 -m venv venv
    source venv/bin/activate
    ```
2.  Install dependencies:
    ```bash
    pip install -r backend/requirements.txt
    ```

## 3. Frontend Setup
1.  Install Node.js (if not already installed).
2.  Install dependencies:
    ```bash
    cd frontend
    npm install
    cd ..
    ```

## 4. Quick Start
Use the provided startup script to run both backend and frontend:
```bash
./start.sh
```

This will start:
- Backend API on `http://localhost:8000`
- Frontend Dashboard on `http://localhost:5173`

## 5. Configure Tapo Hub Connection
1.  Open your browser to `http://localhost:5173`
2.  Click the **⚙️** (Settings) button
3.  Enter your Tapo Hub credentials:
    - **Hub IP Address**: The local IP of your Tapo H100 hub (find this in your router or Tapo app)
    - **Username**: Your Tapo account email
    - **Password**: Your Tapo account password
4.  Click "Save & Connect"

The system will automatically connect to your hub and start monitoring sensor activity.

> [!NOTE]
> **No Matter Server Required**: This application uses the Tapo native API via the `tapo-py` library to communicate directly with your hub. The Matter protocol integration mentioned in earlier versions is no longer needed.

## 6. Using the Dashboard
- The dashboard will show a list of detected sensors.
- **Activity Graph**: Shows activity events over time.
- **Heatmap**: Shows activity intensity by hour and day.
- **Anomalies**: The system analyzes patterns and flags unusual activity. You can trigger analysis manually via the "Run Analysis" button.
