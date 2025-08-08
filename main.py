import asyncio
import json
import os
import logging
import httpx
import hashlib
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from dotenv import load_dotenv
from contextlib import asynccontextmanager
from typing import Dict, Any, Set, List, Optional
from datetime import datetime, timedelta
from pydantic import BaseModel
import openai

# --- Logging Configuration ---
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# --- Configuration ---
load_dotenv()
FINNHUB_API_KEY = os.getenv("FINNHUB_API_KEY")
POLYGON_API_KEY = os.getenv("POLYGON_API_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
LLAMA_BASE_URL = os.getenv("LLAMA_BASE_URL", "http://localhost:11434")  # Ollama fallback
POLL_INTERVAL_SECONDS = 60
RETRY_INTERVAL_SECONDS = 30
IMPORTANCE_THRESHOLD = 7.0  # Only send articles with AI score >= 7.0
USE_OPENAI = True  # Set to False for local Llama development

# --- Clients ---
http_client = httpx.AsyncClient()

# OpenAI client setup
if OPENAI_API_KEY:
    from openai import AsyncOpenAI
    openai_client = AsyncOpenAI(api_key=OPENAI_API_KEY)
else:
    openai_client = None
    logging.warning("OpenAI API key not found - falling back to Llama")

# --- Pydantic Models for Structured Outputs ---
class ArticleClassification(BaseModel):
    article_id: int
    importance_score: float
    summary: str
    is_english: bool

class BatchClassificationResponse(BaseModel):
    classifications: List[ArticleClassification]

# --- WebSocket Connection Manager ---
class ConnectionManager:
    def __init__(self):
        self.active_connections: Set[WebSocket] = set()

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.add(websocket)
        logging.info(f"WebSocket connection accepted. Total connections: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        self.active_connections.discard(websocket)
        logging.info(f"WebSocket disconnected. Total connections: {len(self.active_connections)}")

    async def broadcast(self, message: dict):
        if not self.active_connections:
            return
        
        message_str = json.dumps(message)
        disconnected = set()
        
        for connection in self.active_connections:
            try:
                await connection.send_text(message_str)
            except:
                disconnected.add(connection)
        
        # Remove disconnected connections
        for connection in disconnected:
            self.active_connections.discard(connection)

manager = ConnectionManager()

# In-memory cache for seen articles with content-based deduplication
seen_urls: Set[str] = set()
seen_content_hashes: Set[str] = set()

def get_content_hash(headline: str, summary: str = "") -> str:
    """Generate content hash for deduplication of similar articles."""
    content = f"{headline.lower().strip()} {summary.lower().strip()}"
    return hashlib.md5(content.encode()).hexdigest()

def is_duplicate_content(headline: str, summary: str = "") -> bool:
    """Check if article content is duplicate based on headline/summary similarity."""
    content_hash = get_content_hash(headline, summary)
    if content_hash in seen_content_hashes:
        return True
    seen_content_hashes.add(content_hash)
    return False

# --- AI Classification Functions ---
async def classify_news_batch_openai(articles: list) -> list:
    """
    OpenAI batch classification with Structured Outputs for guaranteed JSON format.
    Uses GPT-4.1-nano for optimal cost-performance ratio.
    """
    if not articles or not openai_client:
        return []
    
    try:
        # Build articles data for structured prompt
        articles_data = []
        for i, article in enumerate(articles, 1):
            headline = article.get('headline', '') or article.get('title', '')
            summary = article.get('summary', '') or article.get('description', '')
            
            articles_data.append({
                "id": i,
                "headline": headline,
                "summary": summary
            })
        
        # Create prompt with enhanced financial context for better accuracy
        system_prompt = """You are a senior financial news analyst with expertise in market-moving events. Rate each article's importance (1-10, decimals allowed) based on potential impact on financial markets and global affairs.

IMPORTANCE SCORING GUIDELINES:
• 9-10: Major central bank decisions, significant geopolitical events, major corporate bankruptcies/mergers
• 7-8: Economic data releases, earnings from major companies, regulatory changes
• 5-6: Industry news, moderate corporate announcements, regional economic updates
• 3-4: Routine corporate news, minor policy updates, sector-specific news
• 1-2: General news with minimal market impact, non-English articles

CRITICAL RULES:
1. If an article is NOT in English, set is_english=false and importance_score=1.0
2. Breaking news gets +1 point if it's genuinely market-moving
3. Focus on immediate market impact potential, not long-term trends
4. Summary should be 2 concise sentences focusing on market implications"""

        user_prompt = f"Analyze these {len(articles_data)} articles:\n\n"
        for article in articles_data:
            user_prompt += f"Article {article['id']}:\n"
            user_prompt += f"Headline: {article['headline']}\n"
            if article['summary']:
                user_prompt += f"Summary: {article['summary']}\n"
            user_prompt += "\n"

        # Use OpenAI with Structured Outputs
        response = await openai_client.beta.chat.completions.parse(
            model="gpt-4o-mini",  # Most cost-effective for structured tasks
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            response_format=BatchClassificationResponse,
            temperature=0.1,  # Low temperature for consistent scoring
            max_tokens=2000
        )
        
        result = response.choices[0].message.parsed
        if not result or not hasattr(result, 'classifications'):
            logging.warning("OpenAI returned invalid response structure")
            return []
            
        classifications = []
        
        for classification in result.classifications:
            classifications.append({
                "article_id": classification.article_id,
                "importance_score": classification.importance_score,
                "summary": classification.summary,
                "is_english": classification.is_english
            })
        
        logging.info(f"✅ OpenAI batch classified {len(classifications)} articles")
        return classifications
        
    except Exception as e:
        logging.error(f"OpenAI batch classification error: {e}")
        return []

async def classify_news_batch(articles: list) -> list:
    """
    Smart batch classification that uses OpenAI in production or Llama for development.
    """
    if USE_OPENAI and openai_client:
        return await classify_news_batch_openai(articles)
    else:
        return await classify_news_batch_llama(articles)

async def classify_news_batch_llama(articles: list) -> list:
    """
    Llama batch classification (development fallback).
    """
    if not articles:
        return []
    
    try:
        # Build batch prompt with multiple articles
        articles_text = ""
        for i, article in enumerate(articles, 1):
            headline = article.get('headline', '') or article.get('title', '')
            summary = article.get('summary', '') or article.get('description', '')
            
            articles_text += f"Article {i}:\n"
            articles_text += f"Headline: {headline}\n"
            if summary:
                articles_text += f"Summary: {summary}\n"
            articles_text += "\n"
        
        prompt = f"""Rate each article's importance (1-10, decimals allowed) based on potential impact on financial markets and global affairs. If an article is NOT in English, automatically score it 1.0.

{articles_text}

Respond ONLY with a JSON array in this exact format:
[
  {{"article_id": 1, "importance_score": 8.5, "summary": "Two sentence summary of article 1.", "is_english": true}},
  {{"article_id": 2, "importance_score": 6.2, "summary": "Two sentence summary of article 2.", "is_english": true}},
  ...
]"""

        response = await http_client.post(
            f"{LLAMA_BASE_URL}/api/generate",
            json={
                "model": "llama3.1:8b",
                "prompt": prompt,
                "stream": False,
                "format": "json"
            },
            timeout=60.0
        )
        
        if response.status_code == 200:
            result_data = response.json()
            result_text = result_data.get("response", "")
            results = json.loads(result_text)
            
            logging.info(f"🦙 Llama batch classified {len(results)} articles")
            return results
        else:
            logging.warning(f"Llama batch API error: {response.status_code}")
            return []
            
    except Exception as e:
        logging.error(f"Error in Llama batch classification: {e}")
        return []

async def classify_news_importance(headline: str, summary: str = "") -> dict:
    """
    Single article classification (fallback for individual processing).
    TODO: BEFORE DEPLOYMENT - Switch to OpenAI for production
    """
    try:
        text_to_analyze = f"Headline: {headline}"
        if summary:
            text_to_analyze += f"\nSummary: {summary}"
        
        prompt = f"""Given the frame of recent 24 hours in the world, what would you rate this article's importance out of ten, decimals allowed.

{text_to_analyze}

IMPORTANT: If this article is NOT in English, automatically return a score of 1.0".

Respond ONLY with a JSON object in this exact format:
{{"importance_score": 8.5, "summary": "Two sentence summary of the article content."}}"""

        # TODO: BEFORE DEPLOYMENT - Replace with OpenAI API call
        try:
            response = await http_client.post(
                f"{LLAMA_BASE_URL}/api/generate",
                json={
                    "model": "llama3.1:8b",
                    "prompt": prompt,
                    "stream": False,
                    "format": "json"
                },
                timeout=30.0
            )
            
            if response.status_code == 200:
                result_data = response.json()
                result_text = result_data.get("response", "")
                result = json.loads(result_text)
                
                importance_score = float(result.get("importance_score", 5.0))
                summary = result.get("summary", "AI-generated summary")
                
                logging.info(f"Llama classified '{headline[:50]}...' as {importance_score}/10")
                
                return {
                    "importance_score": importance_score,
                    "summary": summary
                }
            else:
                logging.warning(f"Llama API error: {response.status_code}")
                return {"importance_score": 0.0, "summary": "AI error - article skipped"}
                
        except Exception as llama_error:
            logging.warning(f"Llama connection failed: {llama_error}. Skipping article.")
            return {
                "importance_score": 0.0,
                "summary": "AI unavailable - article skipped"
            }
        
    except Exception as e:
        logging.error(f"Error in AI classification: {e}")
        return {"importance_score": 0.0, "summary": f"Classification error: {str(e)}"}

# --- Batch Article Processing ---
async def process_articles_batch(articles: list):
    """Process multiple articles efficiently with smart deduplication and OpenAI classification."""
    if not articles:
        return
    
    # Filter out duplicate articles (URL and content-based)
    new_articles = []
    for article in articles:
        headline = article.get('headline', '') or article.get('title', '')
        summary = article.get('summary', '') or article.get('description', '')
        article_url = article.get('url') or article.get('article_url', '')
        
        if not headline or not article_url:
            continue
            
        # Skip URL duplicates
        if article_url in seen_urls:
            continue
            
        # Skip content duplicates
        if is_duplicate_content(headline, summary):
            logging.debug(f"⚠️ CONTENT DUPLICATE: {headline[:50]}...")
            continue
            
        seen_urls.add(article_url)
        new_articles.append(article)
    
    if not new_articles:
        logging.debug("No new articles to process after deduplication")
        return
    
    logging.info(f"Processing {len(new_articles)} new articles (filtered from {len(articles)} total)")
    
    # Get batch AI classification for all articles at once
    classifications = await classify_news_batch(new_articles)
    
    # Process results
    important_articles = 0
    for j, classification in enumerate(classifications):
        if j >= len(new_articles):
            break
            
        article = new_articles[j]
        article_id = classification.get("article_id", j + 1)
        
        # Ensure we're matching the right article
        if article_id - 1 != j:
            logging.warning(f"Article ID mismatch: expected {j + 1}, got {article_id}")
            continue
        
        importance_score = float(classification.get("importance_score", 0.0))
        ai_summary = classification.get("summary", "No summary available")
        is_english = classification.get("is_english", True)
        
        headline = article.get('headline', '') or article.get('title', '')
        article_url = article.get('url') or article.get('article_url', '')
        source = article.get('source', 'Unknown')
        
        # Skip non-English articles automatically
        if not is_english:
            logging.debug(f"⏭️ NON-ENGLISH: {headline[:50]}...")
            continue
        
        # Only send if above threshold
        if importance_score >= IMPORTANCE_THRESHOLD:
            payload = {
                "headline": headline,
                "source": source,
                "url": article_url,
                "importance_score": importance_score,
                "summary": ai_summary,
                "timestamp": int(datetime.now().timestamp())
            }
            
            important_articles += 1
            logging.info(f"✅ SENDING: {headline[:60]}... (Score: {importance_score}/10)")
            await manager.broadcast(payload)
        else:
            logging.debug(f"⏭️ SKIPPED: {headline[:60]}... (Score: {importance_score}/10 < {IMPORTANCE_THRESHOLD})")
    
    logging.info(f"📊 Batch complete: {important_articles}/{len(classifications)} articles sent to users")

# --- Single Article Processing (Fallback) ---
async def process_article(article: Dict[str, Any]):
    """Process a single news article with AI classification."""
    headline = article.get('headline', '') or article.get('title', '')
    summary = article.get('summary', '') or article.get('description', '')
    article_url = article.get('url') or article.get('article_url', '')
    source = article.get('source', 'Unknown')

    if not headline or not article_url:
        return

    # Skip if we've already seen this URL
    if article_url in seen_urls:
        return
    
    seen_urls.add(article_url)
    
    # Get AI classification
    classification = await classify_news_importance(headline, summary)
    importance_score = classification["importance_score"]
    ai_summary = classification["summary"]
    
    # Only send if above threshold
    if importance_score >= IMPORTANCE_THRESHOLD:
        payload = {
            "headline": headline,
            "source": source,
            "url": article_url,
            "importance_score": importance_score,
            "summary": ai_summary,
            "timestamp": int(datetime.now().timestamp())
        }
        
        logging.info(f"✅ SENDING: {headline[:80]}... (Score: {importance_score}/10)")
        await manager.broadcast(payload)
    else:
        logging.debug(f"⏭️ SKIPPED: {headline[:80]}... (Score: {importance_score}/10 < {IMPORTANCE_THRESHOLD})")

# --- News Polling Functions ---
async def finnhub_news_poller():
    """Poll Finnhub for news."""
    logging.info("Starting Finnhub news poller...")
    
    if not FINNHUB_API_KEY:
        logging.error("FINNHUB_API_KEY not found")
        return
    
    while True:
        try:
            url = f"https://finnhub.io/api/v1/news?category=general&count=50&token={FINNHUB_API_KEY}"
            response = await http_client.get(url, timeout=10.0)
            response.raise_for_status()
            news = response.json()
            
            logging.info(f"Received {len(news)} articles from Finnhub")
            
            # Use batch processing for efficiency
            await process_articles_batch(news)

            await asyncio.sleep(POLL_INTERVAL_SECONDS)
            
        except Exception as e:
            logging.error(f"Finnhub polling error: {e}. Retrying in {RETRY_INTERVAL_SECONDS}s...")
            await asyncio.sleep(RETRY_INTERVAL_SECONDS)

async def polygon_news_poller():
    """Poll Polygon.io for news."""
    logging.info("Starting Polygon.io news poller...")
    
    if not POLYGON_API_KEY:
        logging.error("POLYGON_API_KEY not found")
        return
    
    while True:
        try:
            params = {
                "apikey": POLYGON_API_KEY,
                "limit": 50,
                "order": "desc",
                "sort": "published_utc"
            }
            
            url = "https://api.polygon.io/v2/reference/news"
            response = await http_client.get(url, params=params, timeout=10.0)
            response.raise_for_status()
            data = response.json()
            
            if data.get("status") != "OK":
                logging.error(f"Polygon API error: {data.get('error', 'Unknown error')}")
                await asyncio.sleep(RETRY_INTERVAL_SECONDS)
                continue
            
            articles = data.get("results", [])
            logging.info(f"Received {len(articles)} articles from Polygon.io")
            
            # Use batch processing for efficiency
            await process_articles_batch(articles)

            await asyncio.sleep(max(POLL_INTERVAL_SECONDS, 12))  # Rate limit compliance
            
        except Exception as e:
            logging.error(f"Polygon polling error: {e}. Retrying in {RETRY_INTERVAL_SECONDS}s...")
            await asyncio.sleep(RETRY_INTERVAL_SECONDS)

# --- FastAPI App Setup ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifecycle manager."""
    logging.info("🚀 Starting news classification service...")
    
    # Start news pollers
    finnhub_task = asyncio.create_task(finnhub_news_poller())
    polygon_task = asyncio.create_task(polygon_news_poller())
    
    yield
    
    logging.info("🔄 Shutting down...")
    finnhub_task.cancel()
    polygon_task.cancel()
    await http_client.aclose()
    
    try:
        await finnhub_task
        await polygon_task
    except asyncio.CancelledError:
        pass

app = FastAPI(
    title="AI News Classification Service",
    description="Real-time news with AI importance scoring",
    lifespan=lifespan
)

# --- WebSocket Endpoint ---
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # Keep connection alive
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)

# --- API Endpoints ---
@app.post("/api/test-news")
async def send_test_news():
    """Send test news to verify the system."""
    test_payload = {
        "headline": "TEST: Federal Reserve Announces Emergency Rate Cut",
        "source": "Test Source",
        "url": f"https://example.com/test-{datetime.now().timestamp()}",
        "importance_score": 9.5,
        "summary": "The Federal Reserve has announced an emergency interest rate cut to address current economic conditions. This monetary policy change is expected to have significant market implications.",
        "timestamp": int(datetime.now().timestamp())
    }
    await manager.broadcast(test_payload)
    return {"status": "success", "message": "Test news sent"}

@app.post("/api/configure")
async def configure_ai_provider(use_openai: bool = True):
    """Configure AI provider (OpenAI vs Llama)."""
    global USE_OPENAI
    
    if use_openai and not openai_client:
        return {
            "status": "error", 
            "message": "OpenAI not available - missing API key"
        }
    
    USE_OPENAI = use_openai
    provider = "OpenAI (GPT-4o-mini)" if USE_OPENAI else "Llama (Local)"
    
    logging.info(f"🔄 AI provider switched to: {provider}")
    
    return {
        "status": "success",
        "ai_provider": provider,
        "features_enabled": {
            "structured_outputs": USE_OPENAI,
            "guaranteed_json": USE_OPENAI,
            "cost_optimized": USE_OPENAI
        }
    }

@app.get("/api/status")
async def get_status():
    """Get system status with AI provider information."""
    ai_provider = "OpenAI (GPT-4o-mini)" if USE_OPENAI and openai_client else "Llama (Local)"
    
    return {
        "status": "running",
        "ai_provider": ai_provider,
        "connections": len(manager.active_connections),
        "seen_articles": len(seen_urls),
        "content_hashes": len(seen_content_hashes),
        "threshold": IMPORTANCE_THRESHOLD,
        "apis_configured": {
            "finnhub": bool(FINNHUB_API_KEY),
            "polygon": bool(POLYGON_API_KEY),
            "openai": bool(OPENAI_API_KEY and openai_client),
            "llama_fallback": True,
            "llama_url": LLAMA_BASE_URL
        },
        "features": {
            "structured_outputs": USE_OPENAI and bool(openai_client),
            "content_deduplication": True,
            "english_filtering": True,
            "batch_processing": True
        }
    }

async def classify_news_with_search(article: dict) -> dict:
    """
    Enhanced classification using web search for verification (experimental).
    NOTE: This would cost $0.025 per article vs $0.00003 for regular classification.
    Only consider for highest-importance articles where verification is crucial.
    """
    if not openai_client:
        return {}
    
    try:
        headline = article.get('headline', '') or article.get('title', '')
        summary = article.get('summary', '') or article.get('description', '')
        
        # NOTE: This is conceptual - actual implementation would need proper tool setup
        # Cost: $25 per 1K calls + regular token costs
        response = await openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system", 
                    "content": "You are a financial news analyst. Analyze the market impact of this news article."
                },
                {
                    "role": "user", 
                    "content": f"Rate the market importance (1-10) of:\nHeadline: {headline}\nSummary: {summary}"
                }
            ],
            temperature=0.1,
            max_tokens=300
        )
        
        content = response.choices[0].message.content
        logging.info(f"🔍 Enhanced classification (no search used): {headline[:50]}...")
        return {"enhanced": True, "search_used": False}
        
    except Exception as e:
        logging.error(f"Enhanced classification failed: {e}")
        return {}
