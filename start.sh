#!/bin/bash
# Movement Mapper Startup Script

cd /home/shaun/.gemini/antigravity/scratch/matter_logger

echo "Starting Backend API..."
cd backend
source ../venv/bin/activate
nohup uvicorn main:app --host 0.0.0.0 --port 8000 > ../backend.log 2>&1 &
echo "Backend started (PID: $!)"

echo "Starting Frontend..."
cd ../frontend
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nohup npm run dev -- --host 0.0.0.0 > ../frontend.log 2>&1 &
echo "Frontend started (PID: $!)"

echo ""
echo "✅ All services started!"
echo "   - Backend API: http://localhost:8000"
echo "   - Frontend Dashboard: http://localhost:5173"
echo "   - Tapo sensors: Monitoring via native API"
echo ""
echo "Logs:"
echo "   - Backend: tail -f backend.log"
echo "   - Frontend: tail -f frontend.log"
echo ""
echo "Note: Matter Server (Docker) is optional and not started by this script."
echo "      The system uses Tapo's native API for sensor monitoring."
