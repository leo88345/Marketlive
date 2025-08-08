import AsyncStorage from '@react-native-async-storage/async-storage';

interface NotificationSettings {
  enabled: boolean;
  minScore: number;
  quietHoursStart: number; // 22 (10 PM)
  quietHoursEnd: number;   // 7 (7 AM)
  weekendMode: boolean;    // Reduced notifications on weekends
  pausedUntil?: number;    // Timestamp when notifications resume
}

interface NewsArticle {
  headline: string;
  source: string;
  url: string;
  importance_score: number;
  timestamp: number;
  summary?: string;
}

interface NotificationData {
  title: string;
  message: string;
  timestamp: number;
  article: NewsArticle;
}

class NotificationService {
  private static instance: NotificationService;
  private pendingNotifications: NewsArticle[] = [];
  private lastBatchTime: number = 0;
  private notificationHistory: NotificationData[] = [];
  private settings: NotificationSettings = {
    enabled: true,
    minScore: 7.0,
    quietHoursStart: 22, // 10 PM
    quietHoursEnd: 7,    // 7 AM
    weekendMode: true,
    pausedUntil: undefined
  };

  private constructor() {
    this.loadSettings();
    this.startBatchProcessor();
    this.requestNotificationPermission();
  }

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  private async requestNotificationPermission() {
    // For web browsers, request notification permission
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        await Notification.requestPermission();
      }
    }
  }

  private async loadSettings() {
    try {
      const savedSettings = await AsyncStorage.getItem('notification_settings');
      if (savedSettings) {
        this.settings = { ...this.settings, ...JSON.parse(savedSettings) };
      }
    } catch (error) {
      console.error('Error loading notification settings:', error);
    }
  }

  private async saveSettings() {
    try {
      await AsyncStorage.setItem('notification_settings', JSON.stringify(this.settings));
    } catch (error) {
      console.error('Error saving notification settings:', error);
    }
  }

  private isQuietHours(): boolean {
    const now = new Date();
    const currentHour = now.getHours();
    
    // Handle quiet hours that span midnight (e.g., 22 to 7)
    if (this.settings.quietHoursStart > this.settings.quietHoursEnd) {
      return currentHour >= this.settings.quietHoursStart || currentHour < this.settings.quietHoursEnd;
    }
    
    return currentHour >= this.settings.quietHoursStart && currentHour < this.settings.quietHoursEnd;
  }

  private isWeekend(): boolean {
    const now = new Date();
    const day = now.getDay();
    return day === 0 || day === 6; // Sunday = 0, Saturday = 6
  }

  private isPaused(): boolean {
    if (!this.settings.pausedUntil) return false;
    return Date.now() < this.settings.pausedUntil;
  }

  private shouldSendImmediate(article: NewsArticle): boolean {
    // Critical news (9+) during normal hours, (9.5+) during quiet hours
    const scoreThreshold = this.isQuietHours() ? 9.5 : 9.0;
    return article.importance_score >= scoreThreshold;
  }

  private getNotificationIcon(score: number): string {
    if (score >= 9) return '●';  // Critical
    if (score >= 8) return '▲';  // High
    return '◐';  // Standard
  }

  private formatNotification(article: NewsArticle): { title: string; message: string } {
    const icon = this.getNotificationIcon(article.importance_score);
    const scoreText = `${article.importance_score.toFixed(1)}/10`;
    const priority = article.importance_score >= 9 ? 'CRITICAL' : 
                    article.importance_score >= 8 ? 'HIGH' : 'STANDARD';
    
    return {
      title: `${icon} ${priority} • ${article.source}`,
      message: article.headline
    };
  }

  public async handleNewsArticle(article: NewsArticle) {
    if (!this.settings.enabled || this.isPaused()) {
      return;
    }

    // Filter by minimum score
    if (article.importance_score < this.settings.minScore) {
      return;
    }

    // Weekend mode: only 8+ scores
    if (this.isWeekend() && this.settings.weekendMode && article.importance_score < 8.0) {
      return;
    }

    // Immediate notification for critical news
    if (this.shouldSendImmediate(article)) {
      this.sendNotification(article);
      return;
    }

    // Add to pending batch
    this.pendingNotifications.push(article);
  }

  private sendNotification(article: NewsArticle) {
    const { title, message } = this.formatNotification(article);
    
    // Store notification in history
    const notificationData: NotificationData = {
      title,
      message,
      timestamp: Date.now(),
      article
    };
    
    this.notificationHistory.unshift(notificationData);
    
    // Keep only last 50 notifications
    if (this.notificationHistory.length > 50) {
      this.notificationHistory = this.notificationHistory.slice(0, 50);
    }
    
    // For web browsers, use native browser notifications
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      const notification = new Notification(title, {
        body: message,
        icon: '/favicon.png', // You can add an icon here
        tag: article.url, // Prevents duplicate notifications
      });
      
      notification.onclick = () => {
        // Handle notification click - could open article URL
        window.open(article.url, '_blank');
        notification.close();
      };
      
      // Auto-close after 10 seconds
      setTimeout(() => notification.close(), 10000);
    } else {
      // Fallback: Log to console for development
      console.log(`📱 NOTIFICATION: ${title}`, message);
    }
  }

  private sendBatchNotification(articles: NewsArticle[]) {
    if (articles.length === 0) return;

    const highestScore = Math.max(...articles.map(a => a.importance_score));
    const icon = this.getNotificationIcon(highestScore);
    const priority = highestScore >= 9 ? 'CRITICAL' : 
                    highestScore >= 8 ? 'HIGH' : 'STANDARD';
    
    if (articles.length === 1) {
      this.sendNotification(articles[0]);
      return;
    }

    const title = `${icon} ${priority} • ${articles.length} Market Updates`;
    const topHeadline = articles.sort((a, b) => b.importance_score - a.importance_score)[0].headline;
    const message = `${topHeadline.substring(0, 80)}... and ${articles.length - 1} more`;

    // Store batch notification
    const batchNotification: NotificationData = {
      title,
      message,
      timestamp: Date.now(),
      article: articles[0] // Use first article as representative
    };
    
    this.notificationHistory.unshift(batchNotification);
    
    // For web browsers
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      const notification = new Notification(title, {
        body: message,
        icon: '/favicon.png',
        tag: `batch_${Date.now()}`,
      });
      
      notification.onclick = () => {
        // Could open a summary page or the app
        window.focus();
        notification.close();
      };
      
      setTimeout(() => notification.close(), 15000);
    } else {
      console.log(`📱 BATCH NOTIFICATION: ${title}`, message);
    }
  }

  private startBatchProcessor() {
    setInterval(() => {
      if (this.pendingNotifications.length === 0) return;

      const now = Date.now();
      const timeSinceLastBatch = now - this.lastBatchTime;
      const currentHour = new Date().getHours();
      
      let batchInterval: number;
      
      if (this.isQuietHours()) {
        // Quiet hours: batch every 4 hours
        batchInterval = 4 * 60 * 60 * 1000;
      } else if (currentHour >= 9 && currentHour <= 18) {
        // Business hours: batch every 30 minutes for 8+ scores, 2 hours for 7+ scores
        const highPriorityArticles = this.pendingNotifications.filter(a => a.importance_score >= 8);
        batchInterval = highPriorityArticles.length > 0 ? 30 * 60 * 1000 : 2 * 60 * 60 * 1000;
      } else {
        // Evening: batch every 2 hours
        batchInterval = 2 * 60 * 60 * 1000;
      }

      if (timeSinceLastBatch >= batchInterval) {
        this.sendBatchNotification([...this.pendingNotifications]);
        this.pendingNotifications = [];
        this.lastBatchTime = now;
      }
    }, 60 * 1000); // Check every minute
  }

  // Public methods for settings management
  public async updateSettings(newSettings: Partial<NotificationSettings>) {
    this.settings = { ...this.settings, ...newSettings };
    await this.saveSettings();
  }

  public getSettings(): NotificationSettings {
    return { ...this.settings };
  }

  public async pauseNotifications(durationMinutes: number) {
    this.settings.pausedUntil = Date.now() + (durationMinutes * 60 * 1000);
    await this.saveSettings();
  }

  public async resumeNotifications() {
    this.settings.pausedUntil = undefined;
    await this.saveSettings();
  }

  // Get notification history for UI display
  public getNotificationHistory(): NotificationData[] {
    return [...this.notificationHistory];
  }

  // Clear notification history
  public clearNotificationHistory() {
    this.notificationHistory = [];
  }

  // Check if notifications are supported
  public isNotificationSupported(): boolean {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission !== 'denied';
    }
    return false;
  }

  // Get notification permission status
  public getNotificationPermission(): string {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission;
    }
    return 'default';
  }
}

export default NotificationService;
