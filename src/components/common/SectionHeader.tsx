import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Feather from 'react-native-vector-icons/Feather';
import colors from '../../constants/colors';

interface SectionHeaderProps {
  icon: string;
  title: string;
  isDark: boolean;
  themeColors: any;
}

/**
 * 섹션 헤더 컴포넌트
 * 아이콘과 제목을 표시
 */
const SectionHeader: React.FC<SectionHeaderProps> = React.memo(({
  icon,
  title,
  isDark,
  themeColors,
}) => {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionHeaderContent}>
        <View style={[styles.sectionIcon, { backgroundColor: colors.PRIMARY.DEFAULT + '20' }]}>
          <Feather 
            name={icon as any} 
            size={18} 
            color={colors.PRIMARY.DEFAULT} 
          />
        </View>
        <Text style={[styles.sectionTitle, { color: themeColors.text }]}>
          {title}
        </Text>
      </View>
    </View>
  );
});

SectionHeader.displayName = 'SectionHeader';

const styles = StyleSheet.create({
  sectionHeader: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  sectionHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
});

export default SectionHeader;

