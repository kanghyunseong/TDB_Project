import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, ViewStyle } from 'react-native';

interface SkeletonLoaderProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
  animated?: boolean;
}

/**
 * 스켈레톤 로더 컴포넌트
 * 로딩 중 콘텐츠의 플레이스홀더로 사용
 */
export const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({
  width = '100%',
  height = 20,
  borderRadius = 4,
  style,
  animated = true,
}) => {
  const shimmerAnimation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (animated) {
      const shimmer = Animated.loop(
        Animated.sequence([
          Animated.timing(shimmerAnimation, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(shimmerAnimation, {
            toValue: 0,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      );
      shimmer.start();
      return () => shimmer.stop();
    }
  }, [animated, shimmerAnimation]);

  const opacity = animated
    ? shimmerAnimation.interpolate({
        inputRange: [0, 1],
        outputRange: [0.3, 0.7],
      })
    : 0.5;

  const widthStyle = typeof width === 'string' 
    ? { width: width as any } 
    : { width };

  return (
    <Animated.View
      style={[
        styles.skeleton,
        widthStyle,
        {
          height,
          borderRadius,
          opacity,
        },
        style,
      ]}
    />
  );
};

/**
 * 약물 카드 스켈레톤
 */
export const MedicineCardSkeleton: React.FC<{ isDark?: boolean }> = ({ isDark = false }) => {
  return (
    <View style={[styles.medicineCard, { backgroundColor: isDark ? '#2a2a2a' : '#f0f0f0' }]}>
      <View style={styles.medicineCardHeader}>
        <SkeletonLoader width={120} height={18} borderRadius={4} />
        <SkeletonLoader width={60} height={16} borderRadius={4} />
      </View>
      <View style={styles.medicineCardBody}>
        <SkeletonLoader width="100%" height={14} borderRadius={4} style={styles.marginBottom} />
        <SkeletonLoader width="80%" height={14} borderRadius={4} />
      </View>
      <View style={styles.medicineCardFooter}>
        <SkeletonLoader width={80} height={12} borderRadius={4} />
        <SkeletonLoader width={100} height={12} borderRadius={4} />
      </View>
    </View>
  );
};

/**
 * 대시보드 통계 카드 스켈레톤
 */
export const StatsCardSkeleton: React.FC<{ isDark?: boolean }> = ({ isDark = false }) => {
  return (
    <View style={[styles.statsCard, { backgroundColor: isDark ? '#2a2a2a' : '#f0f0f0' }]}>
      <SkeletonLoader width={40} height={40} borderRadius={20} style={styles.statsIcon} />
      <SkeletonLoader width={60} height={20} borderRadius={4} style={styles.marginBottom} />
      <SkeletonLoader width={40} height={16} borderRadius={4} />
    </View>
  );
};

/**
 * 구성원 카드 스켈레톤
 */
export const MemberCardSkeleton: React.FC<{ isDark?: boolean }> = ({ isDark = false }) => {
  return (
    <View style={[styles.memberCard, { backgroundColor: isDark ? '#2a2a2a' : '#f0f0f0' }]}>
      <View style={styles.memberCardHeader}>
        <SkeletonLoader width={80} height={18} borderRadius={4} />
        <SkeletonLoader width={60} height={16} borderRadius={4} />
      </View>
      <View style={styles.memberCardBody}>
        <SkeletonLoader width="100%" height={12} borderRadius={4} style={styles.marginBottom} />
        <SkeletonLoader width="90%" height={12} borderRadius={4} style={styles.marginBottom} />
        <SkeletonLoader width="70%" height={12} borderRadius={4} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: '#e0e0e0',
  },
  medicineCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  medicineCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  medicineCardBody: {
    marginBottom: 12,
  },
  medicineCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  marginBottom: {
    marginBottom: 8,
  },
  statsCard: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    minWidth: 100,
  },
  statsIcon: {
    marginBottom: 12,
  },
  memberCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  memberCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  memberCardBody: {
    marginTop: 8,
  },
});

