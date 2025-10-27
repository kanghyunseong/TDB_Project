import React, { useEffect } from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import MainBottomTabNavigator from "../bottom/MainBottomTabNavigator";
import AuthStackNavigator from "../stack/AuthStackNavigator";
import { useAuth } from "../../contexts/AuthContext";
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import MedicineSearchScreen from '../../screens/MedicineSearchScreen';
import MedicineDetailScreen from '../../screens/MedicineDetailScreen';
import MedicineScheduleEditScreen from '../../screens/MedicineScheduleEditScreen';
import ItemDetailScreen from '../../screens/ItemDetailScreen';
import MemberDetailScreen from '../../screens/MemberDetailScreen';
import { useTheme } from '../../contexts/ThemeContext';
import SupplementDetailScreen from "../../screens/SupplementDetailScreen";
import SupplementEditScreen from "../../screens/SupplementEditScreen";
import SupplementScheduleEditScreen from "../../screens/SupplementScheduleEditScreen";
import QRScannerScreen from "../../screens/QRScannerScreen";
import SplashScreen from 'react-native-splash-screen';
import MonthlyReportScreen from '../../screens/MonthlyReportScreen';
import DoseTimeSettingScreen from '../../screens/DoseTimeSettingScreen';
import FamilyWeeklyStatsScreen from '../../screens/FamilyWeeklyStatsScreen';
const Stack = createNativeStackNavigator();

function RootNavigator() {
  const { isLogin, loading } = useAuth();
  const { colors: themeColors } = useTheme();

  useEffect(() => {
    SplashScreen.hide();
  }, []);

  // 초기 로딩 중일 때 로딩 화면 표시
  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: themeColors.background }]}>
        <ActivityIndicator size="large" color={themeColors.PRIMARY.DEFAULT} />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {isLogin ? (
        <>
          <Stack.Screen 
          name="MainTabs" 
          component={MainBottomTabNavigator} />
          <Stack.Screen 
          name="QRScanner" 
          component={QRScannerScreen}
          options={{
            headerShown: false,
            presentation: 'fullScreenModal',
          }}
          />
          <Stack.Screen 
          name="MedicineSearch" 
          component={MedicineSearchScreen} 
          options={{
            headerShown: false,
            headerTransparent: true,
            headerTitle: '',
            headerBackTitle: '뒤로가기',
            headerTitleStyle: {
              color: themeColors.text,
            },
            headerTintColor: themeColors.text,
          }}
          />
          <Stack.Screen
            name="MedicineDetail"
            component={MedicineDetailScreen as any}
            options={{
              headerShown: false,
              headerTransparent: true,
              headerTitle: '',
              headerBackTitle: '뒤로가기',
              headerTitleStyle: {
                color: themeColors.text,
              },
              headerTintColor: themeColors.text,
            }}
          />
          <Stack.Screen
            name="MedicineScheduleEdit"
            component={MedicineScheduleEditScreen as any}
            options={{
              headerShown: false,
              headerTransparent: true,
              headerTitle: '',
              headerBackTitle: '뒤로가기',
              headerTitleStyle: {
                color: themeColors.text,
              },
              headerTintColor: themeColors.text,
            }}
          />
          <Stack.Screen
            name="MemberDetail"
            component={MemberDetailScreen as any}
            options={{
              headerShown: false,
              headerTransparent: true,
              headerTitle: '',
              headerBackTitle: '뒤로가기',
              headerTitleStyle: {
                color: themeColors.text,
              },
              headerTintColor: themeColors.text,
            }}
          />
           <Stack.Screen
            name="SupplementDetail"
            component={SupplementDetailScreen as any}
            options={{
              headerShown: false,
              headerTransparent: true,
              headerTitle: '',
              headerBackTitle: '뒤로가기',
              headerTitleStyle: {
                color: themeColors.text,
              },
              headerTintColor: themeColors.text,
            }}
          />
          <Stack.Screen
            name="SupplementEdit"
            component={SupplementEditScreen as any}
            options={{
              headerShown: false,
              headerTransparent: true,
              headerTitle: '',
              headerBackTitle: '뒤로가기',
              headerTitleStyle: {
                color: themeColors.text,
              },
              headerTintColor: themeColors.text,
            }}
          />
          <Stack.Screen
            name="SupplementScheduleEdit"
            component={SupplementScheduleEditScreen as any}
            options={{
              headerShown: false,
              headerTransparent: true,
              headerTitle: '',
              headerBackTitle: '뒤로가기',
              headerTitleStyle: {
                color: themeColors.text,
              },
              headerTintColor: themeColors.text,
            }}
          />
          <Stack.Screen
            name="MonthlyReport"
            component={MonthlyReportScreen as any}
            options={{
              headerShown: false,
              headerTransparent: true,
              headerTitle: '',
              headerBackTitle: '뒤로가기',
              headerTitleStyle: {
                color: themeColors.text,
              },
              headerTintColor: themeColors.text,
            }}
          />
          <Stack.Screen
            name="DoseTimeSetting"
            component={DoseTimeSettingScreen as any}
            options={{
              headerShown: false,
              headerTransparent: true,
              headerTitle: '',
              headerBackTitle: '뒤로가기',
              headerTitleStyle: {
                color: themeColors.text,
              },
              headerTintColor: themeColors.text,
            }}
          />
          <Stack.Screen
            name="FamilyWeeklyStats"
            component={FamilyWeeklyStatsScreen as any}
            options={{
              headerShown: false,
              headerTransparent: true,
              headerTitle: '',
              headerBackTitle: '뒤로가기',
              headerTitleStyle: {
                color: themeColors.text,
              },
              headerTintColor: themeColors.text,
            }}
          />
          <Stack.Screen
            name="ItemDetail"
            component={ItemDetailScreen as any}
            options={{
              headerShown: false,
              headerTransparent: true,
              headerTitle: '',
              headerBackTitle: '뒤로가기',
              headerTitleStyle: {
                color: themeColors.text,
              },
              headerTintColor: themeColors.text,
            }}
          />
        </>
      ) : (
        <Stack.Screen name="Auth" component={AuthStackNavigator} />
      )}
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default RootNavigator;
