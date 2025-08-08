import React, { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Linking,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

// --- Configuration ---
const YOUR_LOCAL_IP = '172.20.2.46'; // Update this to your computer's IP
const WEBSOCKET_URL = `ws://${YOUR_LOCAL_IP}:8000/ws`;

// --- Types ---
interface NewsArticle {
  id: string;
  headline: string;
  source: string;
  url: string;
  importance_score: number;
  reasoning?: string;
  timestamp: number;
}

// --- Main App Component ---
const NewsFilterApp: React.FC = () => {
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const ws = new WebSocket(WEBSOCKET_URL);

    ws.onopen = () => {
      console.log('Connected to AI News Classification Server');
      setIsConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const articleData = JSON.parse(event.data);
        const newArticle: NewsArticle = {
          id: `${articleData.url}_${articleData.timestamp}`,
          headline: articleData.headline,
          source: articleData.source,
          url: articleData.url,
          importance_score: articleData.importance_score,
          reasoning: articleData.reasoning,
          timestamp: articleData.timestamp * 1000, // Convert to milliseconds
        };
        
        setNews((prevNews) => [newArticle, ...prevNews.slice(0, 49)]); // Keep only latest 50 articles
        console.log(`📰 Received: ${newArticle.headline} (Score: ${newArticle.importance_score})`);
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setIsConnected(false);
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected');
      setIsConnected(false);
    };

    return () => {
      ws.close();
    };
  }, []);

  const filteredNews = useMemo(() => {
    if (!searchQuery) {
      return news;
    }
    return news.filter((item) =>
      item.headline.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.source.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [news, searchQuery]);

  const getScoreColor = (score: number) => {
    if (score >= 9) return '#ff1744'; // Critical red
    if (score >= 8) return '#ff5722'; // High orange-red
    if (score >= 7) return '#ff9800'; // Important orange
    return '#4caf50'; // Normal green
  };

  const renderItem = ({ item }: { item: NewsArticle }) => (
    <TouchableOpacity 
      style={styles.articleContainer} 
      onPress={() => Linking.openURL(item.url)}
    >
      <View style={styles.articleHeader}>
        <Text style={styles.sourceText}>{item.source}</Text>
        <Text style={styles.timeText}>
          {new Date(item.timestamp).toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
          })}
        </Text>
      </View>
      
      <Text style={styles.headlineText}>{item.headline}</Text>
      
      {item.reasoning && (
        <Text style={styles.reasoningText}>AI: {item.reasoning}</Text>
      )}
      
      <View style={styles.scoreBadge}>
        <View style={[
          styles.scoreContainer,
          { backgroundColor: getScoreColor(item.importance_score) }
        ]}>
          <Text style={styles.scoreText}>
            {item.importance_score.toFixed(1)}/10
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f5f5f5" />
      
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>AI News Filter</Text>
          <Text style={styles.subtitle}>Important News Only (7.0+ Score)</Text>
        </View>
        <View style={styles.connectionStatus}>
          <View style={[
            styles.connectionDot, 
            { backgroundColor: isConnected ? '#34a853' : '#ea4335' }
          ]} />
          <Text style={styles.connectionText}>
            {isConnected ? 'Live' : 'Offline'}
          </Text>
        </View>
      </View>

      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search headlines..."
          placeholderTextColor="#999"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <View style={styles.statsContainer}>
        <Text style={styles.statsText}>
          {filteredNews.length} important articles • {news.length} total received
        </Text>
      </View>

      {filteredNews.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>
            {isConnected 
              ? "🤖 AI is monitoring news...\nImportant articles will appear here (score ≥7.0)" 
              : "📡 Connecting to AI news service..."}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredNews}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
};

// --- Styles ---
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 15,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  connectionStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  connectionDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 6,
  },
  connectionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  searchContainer: {
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  searchInput: {
    height: 45,
    backgroundColor: '#ffffff',
    borderRadius: 22,
    paddingHorizontal: 20,
    fontSize: 16,
    color: '#333',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  statsContainer: {
    paddingHorizontal: 20,
    marginBottom: 15,
  },
  statsText: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
    lineHeight: 24,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  articleContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  articleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sourceText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  timeText: {
    fontSize: 12,
    color: '#999',
  },
  headlineText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    lineHeight: 22,
    marginBottom: 8,
  },
  reasoningText: {
    fontSize: 13,
    color: '#777',
    fontStyle: 'italic',
    marginBottom: 12,
    lineHeight: 18,
  },
  scoreBadge: {
    alignItems: 'flex-end',
  },
  scoreContainer: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
  },
  scoreText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
});

export default NewsFilterApp;
