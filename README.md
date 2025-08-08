# 🤖 AI News Classification System (iPhone App Backend)

A clean, simple news filtering system that uses AI to classify financial news importance and delivers only the most important articles (7.0+ score) to your iPhone app.

## ✅ Clean Setup (Virtual Environment)

Your global Python installation is now clean! All project dependencies are isolated in the virtual environment.

### 🚀 Quick Start

1. **Using the start script** (recommended):
   ```bash
   ./start-server.sh
   ```

2. **Manual start**:
   ```bash
   source venv/bin/activate
   python main.py
   ```

### 📱 Frontend Options

1. **iPhone App**: Your main target - use `App.tsx` with React Native/Expo
2. **HTML Frontend**: Open `news-frontend.html` for testing
3. **API Documentation**: Visit `http://localhost:8000/docs`

## 🔧 Configuration

Copy `.env.example` to `.env` and add your API keys:

```bash
# Required for news sources
FINNHUB_API_KEY=your_key_here
POLYGON_API_KEY=your_key_here

# AI Classification - Currently using Llama (development)
# TODO: BEFORE DEPLOYMENT - Switch to OpenAI for production
LLAMA_BASE_URL=http://localhost:11434
```

## 🎯 How It Works

1. **News Fetching**: Pulls from Finnhub and Polygon.io APIs
2. **AI Classification**: Currently Llama (local) rates each article 1-10 for market importance
3. **Smart Filtering**: Only sends articles with score ≥ 7.0
4. **Real-time Delivery**: WebSocket broadcasts to iPhone app

## 📦 Dependencies (Isolated)

All packages are installed in `venv/` virtual environment:
- FastAPI + Uvicorn (web server)
- WebSockets (real-time updates to iPhone app)
- HTTPX (HTTP client)
- Python-dotenv (environment variables)

## 🧹 Clean Global Environment

✅ No packages installed globally  
✅ Virtual environment isolates dependencies  
✅ Start script handles activation automatically  

## � iPhone App Connection

- **Backend WebSocket**: `ws://YOUR_LOCAL_IP:8000/ws`
- **Update IP**: Change `YOUR_LOCAL_IP` in `App.tsx` to your computer's IP
- **Test Connection**: Use `/api/test-news` endpoint to verify

## ⚠️ DEPLOYMENT REMINDERS

**TODO: BEFORE PRODUCTION DEPLOYMENT**
1. Switch from Llama to OpenAI in `main.py`
2. Add `OPENAI_API_KEY` to production environment
3. Update all TODO comments in the code
4. Test with OpenAI API before going live

---

**Current Status**: Using Llama locally for development. News fetching and WebSocket functionality work perfectly for iPhone app development. Switch to OpenAI before production deployment.
