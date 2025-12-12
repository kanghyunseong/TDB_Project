import React, { useEffect, useRef } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Image, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import colors from '../../constants/colors';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../types/navigation';
import { authNavigations } from '../../constants/navigation';
import CustomButton from '../../components/CustomButton';
import Feather from 'react-native-vector-icons/Feather';

type NavigationProp = NativeStackNavigationProp<AuthStackParamList>;

const AuthHomeScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const arrowAnimation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const startAnimation = () => {
      Animated.sequence([
        Animated.timing(arrowAnimation, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(arrowAnimation, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ]).start(() => startAnimation());
    };

    startAnimation();
  }, []);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.content}>
        <Text style={styles.title}>TEDDY BEAR</Text>
        <Text style={styles.subtitle}>약 먹을 시간이에요!</Text>
        <Image source={require('../../assets/TeddyBear.png')} style={styles.logo} />
        <Text style={styles.subtitle2}>지금 바로 시작하세요!!</Text>
        <Animated.View
          style={[
            styles.arrowContainer,
            {
              transform: [
                {
                  translateY: arrowAnimation.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 40],
                  }),
                },
              ],
              opacity: arrowAnimation.interpolate({
                inputRange: [0, 0.5, 1],
                outputRange: [0.3, 1, 0.3],
              }),
            },
          ]} 
        >
          <Feather name="chevron-down" size={50} color={colors.PRIMARY.DEFAULT} />
        </Animated.View>

        <View style={styles.buttonContainer}>
          <CustomButton
            label="로그인"
            onPress={() => navigation.navigate(authNavigations.LOGIN)}
          />
          <CustomButton
            label="회원가입"
            onPress={() => navigation.navigate(authNavigations.SIGNUP)}
            variant="secondary"
          />
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.WHITE,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    marginBottom: 140,
  },
  title: {
    fontSize: 48,
    fontWeight: 'bold',
    color: colors.BLACK,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 18,
    color: colors.BLACK,
    marginBottom: 40,
  },
  buttonContainer: {
    width: '100%',
    gap: 10,
  },
  logo: {
    width: 140,
    height: 110,
    marginBottom: 40,
  },
  arrowContainer: {
    marginBottom: 40,
    alignItems: 'center',
    padding: 10,
  },
  subtitle2: {
    fontSize: 18,
    color: colors.BLACK,
    marginBottom: 10,
  },
});

export default AuthHomeScreen;