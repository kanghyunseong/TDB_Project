import React, { useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Share,
  Platform,
  Animated,
  Dimensions,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import colors from '../constants/colors';
import Feather from 'react-native-vector-icons/Feather';
import { useTheme } from '../contexts/ThemeContext';

interface QRCodeModalProps {
  visible: boolean;
  onClose: () => void;
  connectId: string;
}

const QRCodeModal: React.FC<QRCodeModalProps> = ({ visible, onClose, connectId }) => {
  const { colors: themeColors, isDark } = useTheme();
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    console.log('QR Code Connect ID:', connectId); // Connect ID 값 확인을 위한 로그
  }, [connectId]);

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0,
          duration: 350,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const qrData = React.useMemo(() => {
    return JSON.stringify({
      type: 'connect_link',
      message: `내 Connect ID: ${connectId}`,
      data: connectId,
      timestamp: new Date().toISOString()
    });
  }, [connectId]);

  const handleShare = async () => {
    try {
      await Share.share({
        message: `내 Connect ID: ${connectId}`,
      });
    } catch (error) {
      console.error('공유하기 실패:', error);
    }
  };

  if (!connectId) {
    console.warn('Connect ID가 없습니다.');
    return null;
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <Animated.View style={[styles.modalContainer, { opacity: fadeAnim }]}>
        <Animated.View style={[
          styles.modalContent, 
          { 
            backgroundColor: themeColors.background,
            transform: [{ scale: scaleAnim }]
          }
        ]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: themeColors.text }]}>QR 코드</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Feather name="x" size={24} color={themeColors.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.qrContainer}>
            {connectId ? (
              <QRCode
                value={qrData}
                size={200}
                backgroundColor={colors.WHITE}
                color={colors.BLACK}
                onError={(error: any) => console.error('QR 코드 생성 에러:', error)}
              />
            ) : (
              <Text style={styles.errorText}>QR 코드를 생성할 수 없습니다.</Text>
            )}
          </View>

          <Text style={[styles.uuidText, { color: themeColors.text }]}>Connect ID: {connectId}</Text>

          <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
            <Feather name="share-2" size={20} color={colors.WHITE} />
            <Text style={styles.shareButtonText}>공유하기</Text>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: colors.WHITE,
    borderRadius: 16,
    padding: 20,
    width: '80%',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.BLACK,
  },
  closeButton: {
    padding: 4,
  },
  qrContainer: {
    padding: 20,
    backgroundColor: colors.WHITE,
    borderRadius: 12,
    marginBottom: 20,
  },
  uuidText: {
    fontSize: 20,
    color: colors.BLACK,
    marginBottom: 20,
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.PRIMARY.DEFAULT,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  shareButtonText: {
    color: colors.WHITE,
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  errorText: {
    color: colors.DANGER.DEFAULT,
    fontSize: 16,
    textAlign: 'center',
  },
});

export default QRCodeModal; 