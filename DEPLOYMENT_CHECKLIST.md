# 🚨 DEPLOYMENT CHECKLIST for iPhone App

## ⚠️ CRITICAL: Before Production Deployment

### 1. Switch from Llama to OpenAI
- [ ] Uncomment `import openai` in `main.py`
- [ ] Comment out Llama-related code in `classify_news_importance()`
- [ ] Restore OpenAI API calls in `classify_news_importance()`
- [ ] Add `OPENAI_API_KEY` to production environment
- [ ] Update `get_status()` endpoint to check OpenAI instead of Llama

### 2. Code Changes Required
**File: `main.py`**
- [ ] Line ~11: Uncomment `import openai`
- [ ] Line ~20: Uncomment `OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")`
- [ ] Line ~27: Uncomment `openai.api_key = OPENAI_API_KEY`
- [ ] Lines ~60-150: Replace Llama logic with original OpenAI logic
- [ ] Line ~340: Update status endpoint to check `"openai": bool(OPENAI_API_KEY)`

### 3. Environment Variables
**Production `.env`**
```bash
FINNHUB_API_KEY=your_production_key
POLYGON_API_KEY=your_production_key
OPENAI_API_KEY=your_production_key  # ← ADD THIS!
# Remove LLAMA_BASE_URL
```

### 4. iPhone App Configuration
- [ ] Update `YOUR_LOCAL_IP` in `App.tsx` to production server IP
- [ ] Test WebSocket connection to production server
- [ ] Verify news classification is working with OpenAI

### 5. Testing Before Launch
- [ ] Test news fetching from both APIs
- [ ] Verify OpenAI classification is working
- [ ] Test WebSocket connection from iPhone app
- [ ] Send test news and verify it appears in app
- [ ] Monitor logs for any errors

### 6. Remove Development Code
- [ ] Remove all TODO comments
- [ ] Remove Llama fallback logic
- [ ] Remove development logging statements
- [ ] Clean up any test endpoints

---

## 🔍 Search for TODOs
Run this command to find all deployment reminders:
```bash
grep -r "TODO: BEFORE DEPLOYMENT" .
```

## 📱 iPhone App Notes
- Backend will be at `ws://YOUR_SERVER_IP:8000/ws`
- Ensure your server allows connections from iPhone app
- Consider using HTTPS/WSS for production
- Test on actual device, not just simulator

---
**Remember**: The current setup with Llama is perfect for iPhone app development and testing. Only switch to OpenAI when you're ready for production deployment!
