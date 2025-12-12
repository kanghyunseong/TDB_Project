import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface DateHeaderProps {
  isDark: boolean;
  themeColors: any;
}

/**
 * 날짜 헤더 컴포넌트
 * 오늘 날짜를 표시
 */
const DateHeader: React.FC<DateHeaderProps> = React.memo(({ isDark, themeColors }) => {
  const today = new Date();
  const monthDay = today.toLocaleDateString('ko-KR', {
    month: 'long',
    day: 'numeric'
  });
  const yearWeekday = today.toLocaleDateString('ko-KR', {
    year: 'numeric',
    weekday: 'long'
  });

  return (
    <View style={styles.dateHeader}>
      <View style={styles.dateContainer}>
        <Text style={[styles.dateMainText, { color: themeColors.text }]}>
          {monthDay}
        </Text>
        <Text style={[styles.dateSubText, { color: isDark ? '#888' : '#666' }]}>
          {yearWeekday}
        </Text>
      </View>
    </View>
  );
});

DateHeader.displayName = 'DateHeader';

const styles = StyleSheet.create({
  dateHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 8,
  },
  dateContainer: {
    alignItems: 'center',
  },
  dateMainText: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  dateSubText: {
    fontSize: 14,
  },
});

export default DateHeader;

