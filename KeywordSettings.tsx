import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  TextInput,
  Alert,
  Switch,
} from 'react-native';

interface KeywordSettingsProps {
  visible: boolean;
  onClose: () => void;
  userId: string;
  serverUrl: string;
  isPremium: boolean;
  onRequirePremium: () => void;
}

const KeywordSettings: React.FC<KeywordSettingsProps> = ({
  visible,
  onClose,
  userId,
  serverUrl,
  isPremium,
  onRequirePremium,
}) => {
  const [keywords, setKeywords] = useState<string[]>([]);
  const [newKeyword, setNewKeyword] = useState('');
  const [importanceThreshold, setImportanceThreshold] = useState(7.0);
  const [personalizedThreshold, setPersonalizedThreshold] = useState(5.0); // Lower threshold for user interests
  const [loading, setLoading] = useState(false);

  // Interest areas that get lower threshold requirements
  const interestAreas = [
    'Technology', 'Cryptocurrency', 'Healthcare', 'Energy', 'Real Estate',
    'Banking', 'Automotive', 'Aerospace', 'Gaming', 'E-commerce', 'AI/ML',
    'Policy & Trade', 'Government & Politics', 'Commodities', 'International'
  ];
  const [selectedAreas, setSelectedAreas] = useState<string[]>([]);

  // Default financial keywords
  const defaultKeywords = [
    'Bitcoin', 'Tesla', 'Apple', 'NVIDIA', 'Fed', 'Interest Rates',
    'Inflation', 'Stock Market', 'Earnings', 'IPO', 'Merger', 'GDP',
    'Unemployment', 'Trade War', 'Tariffs', 'Banking', 'Crypto'
  ];

  useEffect(() => {
    if (visible) {
      loadUserKeywords();
    }
  }, [visible]);

  const loadUserKeywords = async () => {
    try {
      const response = await fetch(`http://${serverUrl}/api/user/${userId}/keywords`);
      const data = await response.json();
      
      if (data.status === 'success') {
        setKeywords(data.data.keywords || []);
        setImportanceThreshold(data.data.importance_threshold || 7.0);
        setPersonalizedThreshold(data.data.personalized_threshold || 5.0);
        setSelectedAreas(data.data.interest_areas || []);
      }
    } catch (error) {
      console.error('Error loading keywords:', error);
      // Set defaults if error
      setKeywords(['bitcoin', 'stock', 'market', 'fed']);
    }
  };

  const saveKeywords = async () => {
    if (!isPremium) {
      onRequirePremium();
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(`http://${serverUrl}/api/user/keywords`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: userId,
          keywords: keywords,
          importance_threshold: importanceThreshold,
          personalized_threshold: personalizedThreshold,
          interest_areas: selectedAreas,
        }),
      });

      const data = await response.json();
      
      if (data.status === 'success') {
        Alert.alert('Success', 'Keywords updated successfully!');
        onClose();
      } else {
        Alert.alert('Error', data.message || 'Failed to update keywords');
      }
    } catch (error) {
      console.error('Error saving keywords:', error);
      Alert.alert('Error', 'Failed to save keywords');
    } finally {
      setLoading(false);
    }
  };

  const addKeyword = () => {
    if (newKeyword.trim() && !keywords.includes(newKeyword.trim().toLowerCase())) {
      if (!isPremium && keywords.length >= 5) {
        onRequirePremium();
        return;
      }
      setKeywords([...keywords, newKeyword.trim().toLowerCase()]);
      setNewKeyword('');
    }
  };

  const removeKeyword = (keyword: string) => {
    setKeywords(keywords.filter(k => k !== keyword));
  };

  const addDefaultKeyword = (keyword: string) => {
    const lowerKeyword = keyword.toLowerCase();
    if (!keywords.includes(lowerKeyword)) {
      setKeywords([...keywords, lowerKeyword]);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.title}>News Preferences</Text>
          <TouchableOpacity
            onPress={() => {
              if (isPremium) {
                saveKeywords();
              } else {
                onRequirePremium();
              }
            }}
            style={styles.saveButton}
            disabled={loading}
          >
            <Text style={styles.saveText}>
              {loading ? 'Saving...' : 'Save'}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.sectionTitle}>Keywords of Interest</Text>
          <Text style={styles.description}>
            {isPremium 
              ? "Add keywords that interest you. You'll receive notifications when news contains these terms."
              : "Add up to 5 keywords to try out the feature. Upgrade to Premium for unlimited keywords."
            }
          </Text>

          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="Add a keyword..."
              placeholderTextColor="#999"
              value={newKeyword}
              onChangeText={setNewKeyword}
              onSubmitEditing={addKeyword}
              returnKeyType="done"
            />
            <TouchableOpacity onPress={addKeyword} style={styles.addButton}>
              <Text style={styles.addButtonText}>Add</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.keywordsContainer}>
            {keywords.map((keyword) => (
              <TouchableOpacity
                key={keyword}
                style={styles.keywordChip}
                onPress={() => removeKeyword(keyword)}
              >
                <Text style={styles.keywordText}>{keyword}</Text>
                <Text style={styles.removeText}>×</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.sectionTitle}>Popular Keywords</Text>
          <View style={styles.defaultKeywords}>
            {defaultKeywords.map((keyword) => (
              <TouchableOpacity
                key={keyword}
                style={[
                  styles.defaultKeywordChip,
                  keywords.includes(keyword.toLowerCase()) && styles.selectedDefaultKeyword
                ]}
                onPress={() => addDefaultKeyword(keyword)}
              >
                <Text style={[
                  styles.defaultKeywordText,
                  keywords.includes(keyword.toLowerCase()) && styles.selectedDefaultText
                ]}>
                  {keyword}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.sectionTitle}>Your Topics</Text>
          <Text style={styles.description}>
            Select topics you care about. We'll use a more sensitive filter for these to make sure you see relevant news.
          </Text>
          <View style={styles.defaultKeywords}>
            {interestAreas.map((area) => (
              <TouchableOpacity
                key={area}
                style={[
                  styles.defaultKeywordChip,
                  selectedAreas.includes(area) && styles.selectedDefaultKeyword
                ]}
                onPress={() => {
                  if (!isPremium) {
                    onRequirePremium();
                    return;
                  }
                  if (selectedAreas.includes(area)) {
                    setSelectedAreas(selectedAreas.filter(a => a !== area));
                  } else {
                    setSelectedAreas([...selectedAreas, area]);
                  }
                }}
              >
                <Text style={[
                  styles.defaultKeywordText,
                  selectedAreas.includes(area) && styles.selectedDefaultText
                ]}>
                  {area}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.sectionTitle}>Sensitivity for Your Topics</Text>
          <Text style={styles.description}>
            This controls how important a story about your topics needs to be before we show it to you. A lower value means you'll see almost every mention.
            {`\n`}Current Level: {personalizedThreshold.toFixed(1)}
          </Text>
          <View style={styles.sliderContainer}>
            <Text style={styles.sliderLabel}>Broad</Text>
            <View style={styles.sliderTrack}>
              <View style={[styles.sliderThumb, { left: `${((personalizedThreshold - 3.0) / 4.0) * 100}%` }]} />
            </View>
            <Text style={styles.sliderLabel}>Focused</Text>
          </View>
          <TouchableOpacity
            style={styles.sliderTouchArea}
            onPress={(event) => {
              if (!isPremium) {
                onRequirePremium();
                return;
              }
              const { locationX } = event.nativeEvent;
              const percentage = locationX / 300; // Approximate slider width
              const newValue = 3.0 + (percentage * 4.0);
              setPersonalizedThreshold(Math.max(3.0, Math.min(7.0, newValue)));
            }}
          />

          <Text style={styles.sectionTitle}>Main Feed Filter</Text>
          <Text style={styles.description}>
            Filter out the noise from your main feed. A higher value shows fewer, more critical headlines. A lower value shows a wider range of stories.
            {`\n`}Current Filter: {importanceThreshold.toFixed(1)}
          </Text>
          <View style={styles.sliderContainer}>
            <Text style={styles.sliderLabel}>Show More</Text>
            <View style={styles.sliderTrack}>
              <TouchableOpacity
                style={[styles.sliderThumb, { left: `${(importanceThreshold - 5) / 5 * 100}%` }]}
                onPressIn={() => {/* Could implement slider logic here */}}
              />
            </View>
            <Text style={styles.sliderLabel}>Show Less</Text>
          </View>
          
          <View style={styles.thresholdButtons}>
            {[5.0, 6.0, 7.0, 8.0, 9.0].map((threshold) => (
              <TouchableOpacity
                key={threshold}
                style={[
                  styles.thresholdButton,
                  importanceThreshold === threshold && styles.selectedThreshold
                ]}
                onPress={() => {
                  if (!isPremium) {
                    onRequirePremium();
                    return;
                  }
                  setImportanceThreshold(threshold)
                }}
              >
                <Text style={[
                  styles.thresholdText,
                  importanceThreshold === threshold && styles.selectedThresholdText
                ]}>
                  {threshold.toFixed(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  closeButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    fontSize: 24,
    color: '#8E8E93',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1C1C1E',
  },
  saveButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#007AFF',
        borderRadius: 0,
        borderWidth: 1,
        borderColor: '#007AFF',
  },
  saveText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1C1C1E',
    marginTop: 24,
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 16,
    lineHeight: 20,
  },
  inputContainer: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  input: {
    flex: 1,
    height: 44,
    backgroundColor: '#FFFFFF',
        borderRadius: 0,
    paddingHorizontal: 12,
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  addButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#34C759',
        borderRadius: 0,
        borderWidth: 1,
        borderColor: '#34C759',
    justifyContent: 'center',
  },
  addButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  keywordsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  keywordChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#007AFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
        borderRadius: 0,
        borderWidth: 1,
        borderColor: '#007AFF',
    margin: 4,
  },
  keywordText: {
    color: '#FFFFFF',
    fontSize: 14,
    marginRight: 4,
  },
  removeText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  defaultKeywords: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  defaultKeywordChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
        borderRadius: 0,
    margin: 4,
    backgroundColor: '#F2F2F7',
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  selectedDefaultKeyword: {
    backgroundColor: '#E3F2FD',
    borderColor: '#007AFF',
  },
  defaultKeywordText: {
    color: '#1C1C1E',
    fontSize: 14,
  },
  selectedDefaultText: {
    color: '#007AFF',
    fontWeight: '600',
  },
  sliderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
  },
  sliderLabel: {
    fontSize: 12,
    color: '#8E8E93',
  },
  sliderTrack: {
    flex: 1,
    height: 4,
    backgroundColor: '#E5E5EA',
    borderRadius: 2,
    marginHorizontal: 12,
    position: 'relative',
  },
  sliderTouchArea: {
    position: 'absolute',
    top: -20,
    left: 60,
    right: 60,
    height: 44,
    backgroundColor: 'transparent',
  },
  sliderThumb: {
    position: 'absolute',
    width: 20,
    height: 20,
    backgroundColor: '#007AFF',
    borderRadius: 10,
    top: -8,
  },
  thresholdButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 32,
  },
  thresholdButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#F2F2F7',
    borderWidth: 1,
    borderColor: '#E5E5EA',
        borderRadius: 0,
  },
  selectedThreshold: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  thresholdText: {
    fontSize: 14,
    color: '#1C1C1E',
  },
  selectedThresholdText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
});

export default KeywordSettings;
