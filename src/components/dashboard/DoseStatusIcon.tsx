import React from 'react';
import Icon from 'react-native-vector-icons/Feather';

interface DoseStatusIconProps {
  status: 'completed' | 'pending' | 'missed' | 'upcoming' | 'excluded';
  size?: number;
}

/**
 * 복용 상태 아이콘 컴포넌트
 */
const DoseStatusIcon: React.FC<DoseStatusIconProps> = React.memo(({ status, size = 20 }) => {
  const getIconConfig = () => {
    switch (status) {
      case 'completed':
        return { name: 'check-circle', color: '#10b981' };
      case 'pending':
        return { name: 'clock', color: '#f59e0b' };
      case 'missed':
        return { name: 'x-circle', color: '#ef4444' };
      case 'upcoming':
        return { name: 'circle', color: '#6b7280' };
      case 'excluded':
        return { name: 'minus-circle', color: '#9ca3af' };
      default:
        return { name: 'circle', color: '#6b7280' };
    }
  };

  const { name, color } = getIconConfig();
  return <Icon name={name} size={size} color={color} />;
});

DoseStatusIcon.displayName = 'DoseStatusIcon';

export default DoseStatusIcon;

