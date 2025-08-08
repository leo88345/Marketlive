import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  TouchableOpacity,
  Modal,
  Alert,
  ScrollView,
} from 'react-native';
import NotificationService from './NotificationService';

interface NotificationSettingsProps {
  visible: boolean;
  onClose: () => void;
}

interface NotificationSettings {
  enabled: boolean;
  minScore: number;
  quietHoursStart: number;
  quietHoursEnd: number;
  weekendMode: boolean;
  pausedUntil?: number;
}

const NotificationSettingsScreen: React.FC<NotificationSettingsProps> = ({ visible, onClose }) => {
  const [settings, setSettings] = useState<NotificationSettings>({
    enabled: true,
    minScore: 7.0,
    quietHoursStart: 22,
    quietHoursEnd: 7,
    weekendMode: true,
    pausedUntil: undefined,
  });

  const notificationService = NotificationService.getInstance();

  useEffect(() => {
    if (visible) {
      loadSettings();
    }
  }, [visible]);

  const loadSettings = () => {
    const currentSettings = notificationService.getSettings();
    setSettings(currentSettings);
  };

  const updateSettings = async (key: string, value: any) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    await notificationService.updateSettings({ [key]: value });
  };

  const pauseNotifications = (minutes: number) => {
    notificationService.pauseNotifications(minutes);
    Alert.alert(
      'Notifications Paused',
      `Notifications will be paused for ${minutes} minutes.`,
      [{ text: 'OK' }]
    );
    loadSettings();
  };

  const resumeNotifications = () => {
    notificationService.resumeNotifications();
    Alert.alert('Notifications Resumed', 'You will now receive notifications again.', [{ text: 'OK' }]);
    loadSettings();
  };

  const formatTime = (hour: number) => {
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${displayHour}:00 ${period}`;
  };

  const isPaused = settings.pausedUntil && Date.now() < settings.pausedUntil;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Notification Settings</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>Done</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content}>
          {/* Enable/Disable Notifications */}
          <View style={styles.section}>
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Enable Notifications</Text>
              <Switch
                value={settings.enabled}
                onValueChange={(value) => updateSettings('enabled', value)}
              />
            </View>
          </View>

          {/* Minimum Score Filter */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Importance Threshold</Text>
            <Text style={styles.sectionDescription}>
              Only receive notifications for articles with importance score above this level
            </Text>
            
            {[7.0, 7.5, 8.0, 8.5, 9.0].map((score) => (
              <TouchableOpacity
                key={score}
                style={[
                  styles.radioOption,
                  settings.minScore === score && styles.radioOptionSelected
                ]}
                onPress={() => updateSettings('minScore', score)}
              >
                <Text style={[
                  styles.radioText,
                  settings.minScore === score && styles.radioTextSelected
                ]}>
                  {score}/10 and above
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Quiet Hours */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Quiet Hours</Text>
            <Text style={styles.sectionDescription}>
              Reduced notifications during these hours ({formatTime(settings.quietHoursStart)} - {formatTime(settings.quietHoursEnd)})
            </Text>
            
            <View style={styles.timeRow}>
              <Text style={styles.timeLabel}>Start:</Text>
              <View style={styles.timeButtons}>
                {[20, 21, 22, 23].map((hour) => (
                  <TouchableOpacity
                    key={hour}
                    style={[
                      styles.timeButton,
                      settings.quietHoursStart === hour && styles.timeButtonSelected
                    ]}
                    onPress={() => updateSettings('quietHoursStart', hour)}
                  >
                    <Text style={[
                      styles.timeButtonText,
                      settings.quietHoursStart === hour && styles.timeButtonTextSelected
                    ]}>
                      {formatTime(hour)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.timeRow}>
              <Text style={styles.timeLabel}>End:</Text>
              <View style={styles.timeButtons}>
                {[6, 7, 8, 9].map((hour) => (
                  <TouchableOpacity
                    key={hour}
                    style={[
                      styles.timeButton,
                      settings.quietHoursEnd === hour && styles.timeButtonSelected
                    ]}
                    onPress={() => updateSettings('quietHoursEnd', hour)}
                  >
                    <Text style={[
                      styles.timeButtonText,
                      settings.quietHoursEnd === hour && styles.timeButtonTextSelected
                    ]}>
                      {formatTime(hour)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          {/* Weekend Mode */}
          <View style={styles.section}>
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Weekend Mode</Text>
                <Text style={styles.settingDescription}>
                  Only high-importance notifications (8.0+) on weekends
                </Text>
              </View>
              <Switch
                value={settings.weekendMode}
                onValueChange={(value) => updateSettings('weekendMode', value)}
              />
            </View>
          </View>

          {/* Pause Options */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Pause Notifications</Text>
            {isPaused ? (
              <View>
                <Text style={styles.pausedText}>
                  Notifications are currently paused
                </Text>
                <TouchableOpacity
                  style={styles.resumeButton}
                  onPress={resumeNotifications}
                >
                  <Text style={styles.resumeButtonText}>Resume Now</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.pauseOptions}>
                {[
                  { label: '30 minutes', minutes: 30 },
                  { label: '1 hour', minutes: 60 },
                  { label: '2 hours', minutes: 120 },
                  { label: 'Until tomorrow', minutes: 24 * 60 },
                ].map((option) => (
                  <TouchableOpacity
                    key={option.minutes}
                    style={styles.pauseButton}
                    onPress={() => pauseNotifications(option.minutes)}
                  >
                    <Text style={styles.pauseButtonText}>{option.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  closeButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  section: {
    backgroundColor: 'white',
    marginTop: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  settingInfo: {
    flex: 1,
  },
  settingLabel: {
    fontSize: 16,
    color: '#333',
    marginBottom: 2,
  },
  settingDescription: {
    fontSize: 14,
    color: '#666',
  },
  radioOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginVertical: 2,
    borderRadius: 8,
    backgroundColor: '#f8f8f8',
  },
  radioOptionSelected: {
    backgroundColor: '#e3f2fd',
  },
  radioText: {
    fontSize: 16,
    color: '#333',
  },
  radioTextSelected: {
    color: '#1976d2',
    fontWeight: '600',
  },
  timeRow: {
    marginVertical: 8,
  },
  timeLabel: {
    fontSize: 16,
    color: '#333',
    marginBottom: 8,
  },
  timeButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  timeButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
    marginBottom: 8,
    borderRadius: 6,
    backgroundColor: '#f0f0f0',
  },
  timeButtonSelected: {
    backgroundColor: '#1976d2',
  },
  timeButtonText: {
    fontSize: 14,
    color: '#333',
  },
  timeButtonTextSelected: {
    color: 'white',
    fontWeight: '600',
  },
  pausedText: {
    fontSize: 16,
    color: '#ff6b35',
    textAlign: 'center',
    marginBottom: 12,
  },
  resumeButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  resumeButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  pauseOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  pauseButton: {
    backgroundColor: '#ff6b35',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    marginRight: 8,
    marginBottom: 8,
  },
  pauseButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default NotificationSettingsScreen;
