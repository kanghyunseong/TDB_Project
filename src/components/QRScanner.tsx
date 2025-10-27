// src/components/QRScanner.tsx
import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Alert } from 'react-native';
import QRCodeScanner from 'react-native-qrcode-scanner';
import { RNCamera } from 'react-native-camera';
import colors from '../constants/colors';
import FontAwesome from 'react-native-vector-icons/FontAwesome';

interface QRScannerProps {
  onScan: (data: string) => void;
  onClose: () => void;
  scanType: 'dispenser' | 'dailyKit';
}

const QRScanner: React.FC<QRScannerProps> = ({ onScan, onClose, scanType }) => {
  const [scanned, setScanned] = useState(false);

  const handleScan = (event: { data: string }) => {
    if (scanned) return;
    setScanned(true);
    
    const rawData = event.data;
    console.log('🔍 원본 QR 데이터:', rawData);
    
    try {
      // 🔥 띄어쓰기 제거 처리
      const cleanedData = rawData.replace(/\s+/g, '');
      console.log('🔧 띄어쓰기 제거된 데이터:', cleanedData);
      
      const data = JSON.parse(cleanedData);
      if (!data.type || !data.uid || !data.createdAt) {
        throw new Error('잘못된 QR 코드입니다.');
      }
      onScan(cleanedData);
    } catch (error) {
      // JSON 파싱 실패 시 띄어쓰기만 제거해서 전달
      const cleanedData = rawData.replace(/\s+/g, '');
      console.log('🔧 JSON 파싱 실패, 단순 문자열로 처리:', cleanedData);
      onScan(cleanedData);
    }
  };

  return (
    <View style={styles.container}>
      <QRCodeScanner
        onRead={handleScan}
        flashMode={RNCamera.Constants.FlashMode.auto}
        topContent={
          <Text style={styles.centerText}>
            {scanType === 'dispenser' ? '디스펜서' : '데일리 키트'} QR 코드를 스캔해주세요
          </Text>
        }
        bottomContent={
          <TouchableOpacity style={styles.buttonTouchable} onPress={() => setScanned(false)}>
            <Text style={styles.buttonText}>다시 스캔</Text>
          </TouchableOpacity>
        }
      />
      <TouchableOpacity style={styles.closeButton} onPress={onClose}>
        <FontAwesome name="times" size={24} color={colors.WHITE} />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerText: {
    fontSize: 18,
    padding: 32,
    color: colors.WHITE,
  },
  buttonText: {
    fontSize: 21,
    color: colors.PRIMARY.DEFAULT,
  },
  buttonTouchable: {
    padding: 16,
  },
  closeButton: {
    position: 'absolute',
    top: 40,
    right: 20,
    backgroundColor: colors.PRIMARY.DEFAULT,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
});

export default QRScanner;