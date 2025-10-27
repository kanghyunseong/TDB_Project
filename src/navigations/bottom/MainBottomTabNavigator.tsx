import React, { useRef } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { mainNavigations } from '../../constants/navigation';
import MainHomeScreen from '../../screens/MainHomeScreen';
import MainMemberScreen from '../../screens/MainMemberScreen';
import MedicineScheduleScreen from '../../screens/MedicineScheduleScreen';
import SettingsScreen from '../../screens/SettingsScreen';
import colors from '../../constants/colors';
import { BottomTabParamList } from '../../types/navigation';
import Feather from 'react-native-vector-icons/Feather';
import { Animated } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import MedicineSearchScreen from '../../screens/MedicineSearchScreen';
import MedicineDetailScreen from '../../screens/MedicineDetailScreen';
import MedicineEditScreen from '../../screens/MedicineEditScreen';
import MedicineScheduleEditScreen from '../../screens/MedicineScheduleEditScreen';
import { MainStackParamList } from '../../types/navigation';

const Tab = createBottomTabNavigator<BottomTabParamList>();
const Stack = createNativeStackNavigator<MainStackParamList>();

const MainBottomTabNavigator = () => {
  const { colors: themeColors, isDark } = useTheme();
  const animatedValues = {
    [mainNavigations.HOME]: useRef(new Animated.Value(1)).current,
    [mainNavigations.MEMBER]: useRef(new Animated.Value(1)).current,
    [mainNavigations.MEDICINE_SCHEDULE]: useRef(new Animated.Value(1)).current,
    [mainNavigations.SETTINGS]: useRef(new Animated.Value(1)).current,
    [mainNavigations.MEDICINE]: useRef(new Animated.Value(1)).current,
  };

  const animateIcon = (tabName: keyof typeof animatedValues) => {
    Animated.sequence([
      Animated.timing(animatedValues[tabName], {
        toValue: 1.2,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(animatedValues[tabName], {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  };

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: themeColors.background,
          borderTopColor: themeColors.border,
        },
        tabBarActiveTintColor: isDark ? themeColors.text : colors.PRIMARY.DEFAULT,
        tabBarInactiveTintColor: isDark ? '#888' : '#aaa',
        tabBarIcon: ({ color, size, focused }) => {
          let iconName = '';
          switch (route.name) {
            case mainNavigations.HOME:
              iconName = 'home';
              break;
            case mainNavigations.MEMBER:
              iconName = 'users';
              break;
            case mainNavigations.MEDICINE_SCHEDULE:
              iconName = 'calendar';
              break;
            case mainNavigations.SETTINGS:
              iconName = 'settings';
              break;
            case mainNavigations.MEDICINE:
              iconName = 'package';
              break;
            default:
              iconName = 'circle';
          }

          if (focused) {
            animateIcon(route.name as keyof typeof animatedValues);
          }

          return (
            <Animated.View
              style={{
                transform: [{ scale: animatedValues[route.name as keyof typeof animatedValues] }],
              }}
            >
              <Feather name={iconName} size={size} color={color} />
            </Animated.View>
          );
        },
      })}
    >
      <Tab.Screen
        name={mainNavigations.HOME}
        component={MainHomeScreen}
        options={{
          tabBarLabel: '홈',
        }}
      />
      <Tab.Screen
        name={mainNavigations.MEMBER}
        component={MainMemberScreen}
        options={{
          tabBarLabel: '대시보드',
          headerTitle: '대시보드',
          headerTitleStyle: {
            color: colors.BLACK,
          },
          headerTintColor: colors.BLACK,
        }}
      />
     
      <Tab.Screen
        name={mainNavigations.SETTINGS}
        component={SettingsScreen}
        options={{
          tabBarLabel: '설정',
        }}
      />
    </Tab.Navigator>
  );
};

const MedicineStack = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: true,
        contentStyle: { backgroundColor: colors.WHITE },
      }}>
      <Stack.Screen name={mainNavigations.MEDICINE_SEARCH} component={MedicineSearchScreen} />
      <Stack.Screen name={mainNavigations.MEDICINE_DETAIL} component={MedicineDetailScreen} />
      <Stack.Screen name={mainNavigations.MEDICINE_EDIT} component={MedicineEditScreen} />
      <Stack.Screen name={mainNavigations.MEDICINE_SCHEDULE} component={MedicineScheduleScreen} />
      <Stack.Screen name={mainNavigations.MEDICINE_SCHEDULE_EDIT} component={MedicineScheduleEditScreen} />
    </Stack.Navigator>
  );
};

export default MainBottomTabNavigator;
