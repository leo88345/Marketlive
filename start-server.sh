#!/bin/bash

# Activate virtual environment and run the news server
echo "🚀 Starting AI News Classification Server..."
echo "📦 Using virtual environment to keep global Python clean"

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "❌ Virtual environment not found. Creating one..."
    python3 -m venv venv
    source venv/bin/activate
    pip install --upgrade pip
    pip install -r requirements.txt
else
    echo "✅ Virtual environment found. Activating..."
    source venv/bin/activate
fi

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "⚠️  No .env file found. Please copy .env.example to .env and add your API keys:"
    echo "   - FINNHUB_API_KEY"
    echo "   - POLYGON_API_KEY" 
    echo "   - OPENAI_API_KEY"
    echo ""
    echo "Starting server anyway (will work with limited functionality)..."
fi

echo "🌐 Server will be available at:"
echo "   Backend API: http://localhost:8000"
echo "   Frontend: http://localhost:8000/docs (FastAPI docs)"
echo "   HTML Demo: Open news-frontend.html in your browser"
echo ""
echo "📱 For React Native app, update YOUR_LOCAL_IP in App.tsx"
echo ""

# Start the server
python main.py
