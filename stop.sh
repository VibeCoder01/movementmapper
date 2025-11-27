#!/bin/bash
# Movement Mapper Shutdown Script

echo "Stopping services..."

# Stop frontend
pkill -f "npm run dev" && echo "✓ Frontend stopped"

# Stop backend
pkill -f "uvicorn main:app" && echo "✓ Backend stopped"

echo "✅ Services stopped"
