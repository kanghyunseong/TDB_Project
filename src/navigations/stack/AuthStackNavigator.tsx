import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AuthHomeScreen from '../../screens/auth/AuthHomeScreen';
import LoginScreen from '../../screens/auth/LoginScreen';
import SignupScreen from '../../screens/auth/SignupScreen';
import { AuthStackParamList } from '../../types/navigation';
import colors from '../../constants/colors';
const Stack = createNativeStackNavigator<AuthStackParamList>();

const AuthStackNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      initialRouteName="AuthHome"
      screenOptions={{
        headerShown: false,
        headerTintColor: colors.BLACK,
        headerTitle: '',
        headerBackTitle: '뒤로가기',
        headerStyle: {
          backgroundColor: colors.WHITE
        },
      }}>
      <Stack.Screen 
        name="AuthHome" 
        component={AuthHomeScreen}
      />
      <Stack.Screen 
        name="Login" 
        component={LoginScreen}
      />
      <Stack.Screen 
        name="Signup" 
        component={SignupScreen}
      />
    </Stack.Navigator>
  );
};

export default AuthStackNavigator; 