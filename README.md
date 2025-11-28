# Movement Mapper

**Movement Mapper** (formerly Matter Activity Logger) is a local-first activity logging and visualization tool designed for smart home motion sensors (specifically Tapo P100/T100 series). It allows you to track, visualize, and analyze movement patterns within your home without relying on cloud dashboards.

## Features

*   **Real-time Activity Logging**: Connects directly to your Tapo Hub to capture motion events in real-time.
*   **Interactive Heatmap**: Visualize activity intensity by hour and day of the week.
*   **Aggregate View**: Combine data from multiple weeks to identify consistent routines and long-term trends.
*   **Sum Mode**: In Aggregate View, toggle "Sum Mode" to see the total activity count for each hour, providing a clear heat-map of high-traffic times.
*   **Data Adjustments**: Manually adjust data points to correct false positives or anomalies directly from the dashboard.
*   **Sensor Management**: Manually refresh sensor list to detect newly added devices immediately.
*   **Diagnostics**: View backend logs directly from the settings panel for troubleshooting.
*   **Privacy Focused**: All data is stored locally in a SQLite database. No external cloud dependency for data storage.

## Getting Started

For detailed installation, hardware requirements, and configuration instructions, please refer to the [Setup Guide](docs/SETUP.md).

### Quick Start

1.  Ensure you have the prerequisites installed (Python 3, Node.js).
2.  Run the startup script:

    ```bash
    ./start.sh
    ```

3.  Open your browser to `http://localhost:5173`.
4.  Click **Settings** to configure your Tapo Hub credentials.

## Technology Stack

*   **Backend**: Python, FastAPI, SQLAlchemy, SQLite
*   **Frontend**: React, Vite, TailwindCSS
*   **Integration**: `tapo-py` library for direct hub communication

## Acknowledgements

This project is built on top of several excellent open-source libraries:

*   **[tapo-py](https://github.com/mihai-dinculescu/tapo)** - Python library for Tapo device integration by Mihai Dinculescu
*   **[FastAPI](https://fastapi.tiangolo.com/)** - Modern, fast web framework for building APIs
*   **[React](https://react.dev/)** - JavaScript library for building user interfaces
*   **[Vite](https://vitejs.dev/)** - Next generation frontend tooling
*   **[TailwindCSS](https://tailwindcss.com/)** - Utility-first CSS framework
*   **[SQLAlchemy](https://www.sqlalchemy.org/)** - Python SQL toolkit and ORM

Special thanks to the Tapo community for reverse-engineering the protocol and making local control possible.

## License

MIT
