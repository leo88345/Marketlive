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
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NotificationService from './NotificationService';
import NotificationSettingsScreen from './NotificationSettingsScreen';
import Icon from './components/Icon';
import SettingsIcon from './components/SettingsIcon';

// --- Configuration ---
const YOUR_LOCAL_IP = '172.20.2.46';
const WEBSOCKET_URL = `ws://${YOUR_LOCAL_IP}:8000/ws`;

// --- Types ---
interface NewsArticle {
  id: string;
  headline: string;
  source: string;
  url: string;
  importance_score: number;
  timestamp: number;
  summary?: string; // Optional since not all articles may have summaries
}

// --- Main App Component ---
const NewsFilterApp: React.FC = () => {
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [subscriptionStatus, setSubscriptionStatus] = useState<'trial' | 'expired' | 'active'>('trial');
  const [trialDaysLeft, setTrialDaysLeft] = useState(14);
  const [notificationService] = useState(() => NotificationService.getInstance());
  const [showNotificationSettings, setShowNotificationSettings] = useState(false);

  // Check subscription status on app load
  useEffect(() => {
    checkSubscriptionStatus();
  }, []);

  const checkSubscriptionStatus = async () => {
    try {
      const installDate = await AsyncStorage.getItem('app_install_date');
      const subscriptionDate = await AsyncStorage.getItem('subscription_date');
      
      if (!installDate) {
        // First time opening app - start trial
        const now = new Date().getTime();
        await AsyncStorage.setItem('app_install_date', now.toString());
        setSubscriptionStatus('trial');
        setTrialDaysLeft(14);
        return;
      }

      const now = new Date().getTime();
      const install = parseInt(installDate);
      const daysSinceInstall = Math.floor((now - install) / (1000 * 60 * 60 * 24));

      if (subscriptionDate) {
        // Check if subscription is still valid (2 weeks = 14 days)
        const subscription = parseInt(subscriptionDate);
        const daysSinceSubscription = Math.floor((now - subscription) / (1000 * 60 * 60 * 24));
        
        if (daysSinceSubscription < 14) {
          setSubscriptionStatus('active');
        } else {
          setSubscriptionStatus('expired');
        }
      } else if (daysSinceInstall < 14) {
        // Still in trial period
        setSubscriptionStatus('trial');
        setTrialDaysLeft(14 - daysSinceInstall);
      } else {
        // Trial expired
        setSubscriptionStatus('expired');
      }
    } catch (error) {
      console.error('Error checking subscription:', error);
    }
  };

  const handleSubscribe = () => {
    Alert.alert(
      "Subscribe to Premium",
      `14-day free trial • Then $0.99 every 2 weeks\n\n${trialDaysLeft > 0 ? `${trialDaysLeft} days left in trial` : 'Trial expired'}`,
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Subscribe $0.99", 
          onPress: async () => {
            // In production, integrate with App Store/Google Play billing
            // For now, simulate successful subscription
            const now = new Date().getTime();
            await AsyncStorage.setItem('subscription_date', now.toString());
            setSubscriptionStatus('active');
            Alert.alert("Success!", "You're now subscribed to premium features!");
          }
        }
      ]
    );
  };

  const showSubscriptionPrompt = () => {
    if (subscriptionStatus === 'expired') {
      Alert.alert(
        "Subscription Required",
        "Your trial has expired. Subscribe to continue getting premium news updates.",
        [
          { text: "Maybe Later", style: "cancel" },
          { text: "Subscribe $0.99", onPress: handleSubscribe }
        ]
      );
      return true;
    }
    return false;
  };

  useEffect(() => {
    // Don't connect if subscription expired
    if (subscriptionStatus === 'expired') {
      showSubscriptionPrompt();
      return;
    }

    const ws = new WebSocket(WEBSOCKET_URL);

    ws.onopen = () => {
      console.log('Connected to WebSocket server');
      setIsConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const articleData = JSON.parse(event.data);
        const newArticle: NewsArticle = {
          ...articleData,
          id: `${articleData.url}_${Date.now()}`,
          timestamp: Date.now(),
        };
        setNews((prevNews) => [newArticle, ...prevNews]);
        
        // Send notification for new article
        notificationService.handleNewsArticle(newArticle);
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
  }, [subscriptionStatus]);

  const filteredNews = useMemo(() => {
    if (!searchQuery) {
      return news;
    }
    return news.filter((item) =>
      item.headline.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [news, searchQuery]);

  const renderItem = ({ item }: { item: NewsArticle }) => (
    <TouchableOpacity 
      style={[
        styles.articleContainer,
        item.importance_score > 9 && styles.highImportanceContainer
      ]} 
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
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f5f5f5" />
      
      <View style={styles.header}>
        <Text style={styles.title}>Live News</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity 
            onPress={() => setShowNotificationSettings(true)} 
            style={styles.notificationButton}
          >
            <SettingsIcon size={16} color="#555" />
          </TouchableOpacity>
          {subscriptionStatus === 'trial' && (
            <TouchableOpacity onPress={handleSubscribe} style={styles.trialButton}>
              <Text style={styles.trialText}>{trialDaysLeft} days left</Text>
            </TouchableOpacity>
          )}
          {subscriptionStatus === 'expired' && (
            <TouchableOpacity onPress={handleSubscribe} style={styles.subscribeButton}>
              <Text style={styles.subscribeText}>Subscribe</Text>
            </TouchableOpacity>
          )}
          <View style={styles.connectionStatus}>
            <View style={[
              styles.connectionDot, 
              { backgroundColor: isConnected ? '#34a853' : '#ea4335' }
            ]} />
          </View>
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

      <FlatList
        data={filteredNews}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
      
      <NotificationSettingsScreen
        visible={showNotificationSettings}
        onClose={() => setShowNotificationSettings(false)}
      />
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
  connectionStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 10,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  trialButton: {
    backgroundColor: '#ff9800',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
  },
  trialText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  subscribeButton: {
    backgroundColor: '#4caf50',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
  },
  subscribeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  connectionDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  searchContainer: {
    paddingHorizontal: 20,
    marginBottom: 15,
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
  highImportanceContainer: {
    borderWidth: 2,
    borderColor: '#ff0000',
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
  notificationButton: {
    paddingHorizontal: 4,
    paddingVertical: 4,
    marginRight: 8,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 28,
    minHeight: 28,
  },
});

export default NewsFilterApp;
