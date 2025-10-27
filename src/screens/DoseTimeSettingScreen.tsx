import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Alert,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../types/navigation';
import Icon from 'react-native-vector-icons/MaterialIcons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTheme } from '../contexts/ThemeContext';
import colors from '../constants/colors';
import Toast from 'react-native-toast-message';
import AsyncStorage from '@react-native-async-storage/async-storage';

type DoseTimeSettingScreenProps = {
  navigation: StackNavigationProp<RootStackParamList, 'DoseTimeSetting'>;
  route: RouteProp<RootStackParamList, 'DoseTimeSetting'>;
};

interface DoseTimeSettings {
  morning: string;
  afternoon: string;
  evening: string;
}

const DOSE_TIME_SETTINGS_KEY = '@dose_time_settings';

const DoseTimeSettingScreen: React.FC<DoseTimeSettingScreenProps> = ({ 
  navigation, 
  route 
}) => {
  const { colors: themeColors, isDark } = useTheme();
  const [doseSettings, setDoseSettings] = useState<DoseTimeSettings>({
    morning: '08:00',
    afternoon: '13:00',
    evening: '19:00'
  });
  
  const [showTimePicker, setShowTimePicker] = useState<{
    show: boolean;
    timeType: 'morning' | 'afternoon' | 'evening' | null;
  }>({
    show: false,
    timeType: null
  });

  useEffect(() => {
    loadDoseTimeSettings();
  }, []);

  const loadDoseTimeSettings = async () => {
    try {
      const savedSettings = await AsyncStorage.getItem(DOSE_TIME_SETTINGS_KEY);
      if (savedSettings) {
        const settings = JSON.parse(savedSettings);
        setDoseSettings(settings);
        console.log('✅ 복용 시간 설정 로드:', settings);
      }
    } catch (error) {
      console.error('복용 시간 설정 로드 에러:', error);
    }
  };

  const saveDoseTimeSettings = async (newSettings: DoseTimeSettings) => {
    try {
      await AsyncStorage.setItem(DOSE_TIME_SETTINGS_KEY, JSON.stringify(newSettings));
      console.log('✅ 복용 시간 설정 저장:', newSettings);
      
      Toast.show({
        type: 'success',
        text1: '설정 저장 완료',
        text2: '복용 시간이 저장되었습니다.',
      });
    } catch (error) {
      console.error('복용 시간 설정 저장 에러:', error);
      Toast.show({
        type: 'error',
        text1: '저장 실패',
        text2: '설정 저장에 실패했습니다.',
      });
    }
  };

  const handleTimeChange = (event: any, selectedTime?: Date) => {
    if (event.type === 'dismissed') {
      setShowTimePicker({ show: false, timeType: null });
      return;
    }

    if (selectedTime && showTimePicker.timeType) {
      const timeString = selectedTime.toTimeString().slice(0, 5); // HH:MM 형식
      const newSettings = {
        ...doseSettings,
        [showTimePicker.timeType]: timeString
      };
      
      setDoseSettings(newSettings);
      saveDoseTimeSettings(newSettings);
    }
    
    setShowTimePicker({ show: false, timeType: null });
  };

  const openTimePicker = (timeType: 'morning' | 'afternoon' | 'evening') => {
    setShowTimePicker({ show: true, timeType });
  };

  const getTimeLabel = (timeType: 'morning' | 'afternoon' | 'evening') => {
    switch (timeType) {
      case 'morning': return { icon: '🌅', label: '아침', color: '#FF9500' };
      case 'afternoon': return { icon: '☀️', label: '점심', color: '#FFD60A' };
      case 'evening': return { icon: '🌙', label: '저녁', color: '#5856D6' };
    }
  };

  const resetToDefault = () => {
    Alert.alert(
      '기본값으로 초기화',
      '복용 시간을 기본값으로 초기화하시겠습니까?\n(아침 08:00, 점심 13:00, 저녁 19:00)',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '초기화',
          style: 'destructive',
          onPress: () => {
            const defaultSettings = {
              morning: '08:00',
              afternoon: '13:00',
              evening: '19:00'
            };
            setDoseSettings(defaultSettings);
            saveDoseTimeSettings(defaultSettings);
          }
        }
      ]
    );
  };

  const createTimeFromString = (timeString: string): Date => {
    const [hours, minutes] = timeString.split(':').map(Number);
    const date = new Date();
    date.setHours(hours, minutes, 0, 0);
    return date;
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]}>
      {/* 헤더 */}
      <View style={[styles.header, { backgroundColor: themeColors.card }]}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Icon name="arrow-back" size={24} color={themeColors.text} />
        </TouchableOpacity>
        
        <Text style={[styles.headerTitle, { color: themeColors.text }]}>
          복용 시간 설정
        </Text>
        
        <TouchableOpacity 
          style={styles.resetButton}
          onPress={resetToDefault}
        >
          <Icon name="refresh" size={24} color={colors.PRIMARY.DEFAULT} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: themeColors.text }]}>
            ⏰ 복용 시간 설정
          </Text>
          <Text style={[styles.sectionDescription, { color: isDark ? '#888' : '#666' }]}>
            각 시간대별 복용 시간을 설정하세요. 설정한 시간에 알림을 받을 수 있습니다.
          </Text>
        </View>

        {/* 시간 설정 카드들 */}
        {(['morning', 'afternoon', 'evening'] as const).map((timeType) => {
          const { icon, label, color } = getTimeLabel(timeType);
          const timeValue = doseSettings[timeType];
          
          return (
            <TouchableOpacity
              key={timeType}
              style={[styles.timeCard, { backgroundColor: themeColors.card }]}
              onPress={() => openTimePicker(timeType)}
            >
              <View style={styles.timeCardLeft}>
                <View style={[styles.timeIcon, { backgroundColor: color + '20' }]}>
                  <Text style={styles.timeIconText}>{icon}</Text>
                </View>
                <View style={styles.timeInfo}>
                  <Text style={[styles.timeLabel, { color: themeColors.text }]}>
                    {label} 복용 시간
                  </Text>
                  <Text style={[styles.timeDescription, { color: isDark ? '#888' : '#666' }]}>
                    매일 {label} 복용 알림 시간
                  </Text>
                </View>
              </View>
              
              <View style={styles.timeCardRight}>
                <Text style={[styles.timeValue, { color: color }]}>
                  {timeValue}
                </Text>
                <Icon name="chevron-right" size={24} color={isDark ? '#888' : '#666'} />
              </View>
            </TouchableOpacity>
          );
        })}

        {/* 설명 섹션 */}
        <View style={[styles.infoCard, { backgroundColor: themeColors.card }]}>
          <View style={styles.infoHeader}>
            <Icon name="info" size={20} color={colors.PRIMARY.DEFAULT} />
            <Text style={[styles.infoTitle, { color: themeColors.text }]}>
              복용 시간 안내
            </Text>
          </View>
          
          <View style={styles.infoContent}>
            <Text style={[styles.infoText, { color: isDark ? '#888' : '#666' }]}>
              • 설정한 시간에 복용 알림을 받을 수 있습니다
            </Text>
            <Text style={[styles.infoText, { color: isDark ? '#888' : '#666' }]}>
              • 개인별로 다른 복용 시간을 설정할 수 있습니다
            </Text>
            <Text style={[styles.infoText, { color: isDark ? '#888' : '#666' }]}>
              • 시간은 24시간 형식으로 저장됩니다
            </Text>
          </View>
        </View>

        <View style={styles.bottomSpacing} />
      </ScrollView>

      {/* 시간 선택기 */}
      {showTimePicker.show && showTimePicker.timeType && (
        <DateTimePicker
          value={createTimeFromString(doseSettings[showTimePicker.timeType])}
          mode="time"
          is24Hour={true}
          display="spinner"
          onChange={handleTimeChange}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginHorizontal: 16,
  },
  resetButton: {
    padding: 8,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  timeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  timeCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  timeIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  timeIconText: {
    fontSize: 20,
  },
  timeInfo: {
    flex: 1,
  },
  timeLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  timeDescription: {
    fontSize: 12,
  },
  timeCardRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeValue: {
    fontSize: 18,
    fontWeight: 'bold',
    marginRight: 8,
  },
  infoCard: {
    padding: 16,
    borderRadius: 12,
    marginTop: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  infoContent: {
    gap: 8,
  },
  infoText: {
    fontSize: 14,
    lineHeight: 20,
  },
  bottomSpacing: {
    height: 40,
  },
});

export default DoseTimeSettingScreen; 