import 'react-native-get-random-values';
import 'react-native-gesture-handler';
import React, {useEffect} from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {StatusBar, Platform} from 'react-native';
import RootNavigator from './src/navigations/root/RootNavigator';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import Toast, {BaseToast, ErrorToast} from 'react-native-toast-message';
import {AuthProvider} from './src/contexts/AuthContext';
import {ThemeProvider} from './src/contexts/ThemeContext';
import {DrugProvider} from './src/contexts/DrugContext';
import {SupplementProvider} from './src/contexts/SupplementContext';

const toastConfig = {
  success: (props: any) => (
    <BaseToast
      {...props}
      style={{
        borderLeftColor: '#10B981',
        marginTop: 10,
        shadowColor: '#000',
        shadowOffset: {width: 0, height: 2},
        shadowOpacity: 0.15,
        shadowRadius: 6,
        elevation: 5,
      }}
      contentContainerStyle={{paddingHorizontal: 15}}
      text1Style={{
        fontSize: 15,
        fontWeight: '600',
      }}
    />
  ),
  error: (props: any) => (
    <ErrorToast
      {...props}
      style={{
        borderLeftColor: '#EF4444',
        marginTop: 10,
        shadowColor: '#000',
        shadowOffset: {width: 0, height: 2},
        shadowOpacity: 0.15,
        shadowRadius: 6,
        elevation: 5,
      }}
      text1Style={{
        fontSize: 15,
        fontWeight: '600',
      }}
      text2Style={{
        fontSize: 13,
      }}
    />
  ),
  warning: (props: any) => (
    <BaseToast
      {...props}
      style={{
        borderLeftColor: '#F59E0B',
        backgroundColor: '#FEF3C7',
        marginTop: 10,
        shadowColor: '#000',
        shadowOffset: {width: 0, height: 2},
        shadowOpacity: 0.15,
        shadowRadius: 6,
        elevation: 5,
      }}
      contentContainerStyle={{paddingHorizontal: 15}}
      text1Style={{
        fontSize: 15,
        fontWeight: '600',
        color: '#92400E',
      }}
      text2Style={{
        fontSize: 13,
        color: '#78350F',
      }}
    />
  ),
  info: (props: any) => (
    <BaseToast
      {...props}
      style={{
        borderLeftColor: '#007AFF',
        backgroundColor: '#E3F2FD',
        marginTop: 10,
        shadowColor: '#000',
        shadowOffset: {width: 0, height: 2},
        shadowOpacity: 0.15,
        shadowRadius: 6,
        elevation: 5,
      }}
      contentContainerStyle={{paddingHorizontal: 15}}
      text1Style={{
        fontSize: 15,
        fontWeight: '600',
        color: '#1565C0',
      }}
      text2Style={{
        fontSize: 13,
        color: '#1976D2',
      }}
    />
  ),
};

function App() {
  return (
    <SupplementProvider>
      <DrugProvider>
        <GestureHandlerRootView style={{flex: 1}}>
          {/* 🔥 전역 StatusBar 설정 - 모든 화면에서 상태 바 표시 */}
          <StatusBar
            barStyle="dark-content" // 기본값 (각 화면에서 개별 설정 가능)
            backgroundColor="transparent" // Android: 투명 배경
            translucent={false} // Android: 상태 바가 콘텐츠 위에 표시되지 않도록
            hidden={false} // 상태 바 항상 표시
          />
          <ThemeProvider>
            <AuthProvider>
              <NavigationContainer>
                <RootNavigator />
                <Toast
                  config={toastConfig}
                  position="top"
                  topOffset={60}
                  bottomOffset={100}
                  visibilityTime={4000}
                  autoHide={true}
                />
              </NavigationContainer>
            </AuthProvider>
          </ThemeProvider>
        </GestureHandlerRootView>
      </DrugProvider>
    </SupplementProvider>
  );
}

export default App;
