import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';

interface ProgressCircleProps {
  percentage: number;
  size: number;
  strokeWidth: number;
  color: string;
  backgroundColor?: string;
}

/**
 * 진행률 원형 차트 컴포넌트
 */
const ProgressCircle: React.FC<ProgressCircleProps> = React.memo(({ 
  percentage, 
  size, 
  strokeWidth, 
  color, 
  backgroundColor 
}) => {
  const { isDark } = useTheme();
  const defaultBgColor = backgroundColor || (isDark ? '#333' : '#f0f0f0');
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDasharray = circumference;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <View style={[
      styles.progressCircleContainer,
      { 
        width: size, 
        height: size, 
        borderRadius: size / 2,
        borderWidth: strokeWidth,
        borderColor: defaultBgColor 
      }
    ]}>
      {/* 진행률 표시를 위한 오버레이 */}
      <View 
        style={[
          styles.progressOverlay,
          { 
            width: size - strokeWidth * 2, 
            height: size - strokeWidth * 2,
            borderRadius: (size - strokeWidth * 2) / 2,
            borderWidth: strokeWidth / 2,
            borderColor: color,
            borderTopColor: color,
            borderRightColor: percentage > 25 ? color : defaultBgColor,
            borderBottomColor: percentage > 50 ? color : defaultBgColor,
            borderLeftColor: percentage > 75 ? color : defaultBgColor,
          }
        ]}
      />
      <View style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ fontSize: size / 6, fontWeight: 'bold', color }}>
          {percentage}%
        </Text>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  progressCircleContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  progressOverlay: {
    position: 'absolute',
  },
});

ProgressCircle.displayName = 'ProgressCircle';

export default ProgressCircle;

