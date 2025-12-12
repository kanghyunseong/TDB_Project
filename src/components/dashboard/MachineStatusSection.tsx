import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { MachineStatus } from '../../hooks/useFamilyDashboard';

interface MachineStatusSectionProps {
  machineStatus: MachineStatus[];
  connectedDevices: number;
  totalDevices: number;
}

/**
 * 기기 상태 섹션 컴포넌트
 */
const MachineStatusSection: React.FC<MachineStatusSectionProps> = ({
  machineStatus,
  connectedDevices,
  totalDevices,
}) => {
  const { colors: themeColors, isDark } = useTheme();

  return (
    <View style={[
      styles.machineContainer,
      { backgroundColor: themeColors.card }
    ]}>
      <Text style={[styles.sectionTitle, { color: themeColors.text }]}>스마트 기기 현황</Text>
      <View style={styles.machineStatusRow}>
        <Text style={[styles.machineStatusText, { color: themeColors.text }]}>
          연결된 기기: {connectedDevices}/{totalDevices}
        </Text>
        <View style={[
          styles.connectionStatus,
          { backgroundColor: connectedDevices === totalDevices ? '#10b981' : '#f59e0b' }
        ]}>
          <Text style={styles.connectionStatusText}>
            {connectedDevices === totalDevices ? '정상' : '일부 미연결'}
          </Text>
        </View>
      </View>
      
      {machineStatus.map((machine) => (
        <View key={machine.machine_id} style={[
          styles.machineCard,
          { backgroundColor: isDark ? '#2a2a2a' : '#f8f9fa' }
        ]}>
          <View style={styles.machineHeader}>
            <Text style={[styles.machineId, { color: themeColors.text }]}>기기 : {machine.machine_id}</Text>
            <View style={[
              styles.machineConnectionDot,
              { backgroundColor: machine.isConnected ? '#10b981' : '#ef4444' }
            ]} />
          </View>
          <Text style={[styles.machineDetails, { color: isDark ? '#888' : '#666' }]}>
            활성 슬롯: {machine.activeSlots}/{machine.totalSlots}
            {machine.lowStockSlots > 0 && ` (부족: ${machine.lowStockSlots}개)`}
          </Text>
          <Text style={[styles.machineUsers, { color: isDark ? '#888' : '#666' }]}>
            사용자: {machine.users.map(u => u.name).join(', ')}
          </Text>
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  machineContainer: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  machineStatusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  machineStatusText: {
    fontSize: 16,
    fontWeight: '600',
  },
  connectionStatus: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  connectionStatusText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  machineCard: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  machineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  machineId: {
    fontSize: 14,
    fontWeight: '600',
  },
  machineConnectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  machineDetails: {
    fontSize: 12,
    marginBottom: 4,
  },
  machineUsers: {
    fontSize: 12,
  },
});

export default React.memo(MachineStatusSection);

