import React, {useState, useEffect} from 'react';
import {StyleSheet, View, Text, SafeAreaView, TouchableOpacity} from 'react-native';
import colors from '../../constants/colors';
import { ScrollView } from 'react-native-gesture-handler';
import InputField from '../../components/InputField';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../types/navigation';
import CustomButton from '../../components/CustomButton';
import { useAuth } from '../../contexts/AuthContext';
import { authNavigations } from '../../constants/navigation';
import Toast from 'react-native-toast-message';
import AsyncStorage from '@react-native-async-storage/async-storage';

type NavigationProp = NativeStackNavigationProp<AuthStackParamList>;

const LoginScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProp<AuthStackParamList, 'Login'>>();
  const { login, isLogin, signup } = useAuth();
  
  const [id, setId] = useState('');
  const [password, setPassword] = useState('');
  const [idError, setIdError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [idTouched, setIdTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [name, setName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [age, setAge] = useState('');
  const [accountType, setAccountType] = useState('parent');
  const [connect, setConnect] = useState('');
  const [mUid, setMUid] = useState('');
  const [kUid, setKUid] = useState('');
  const [refreshToken, setRefreshToken] = useState('');

  useEffect(() => {
  if (isLogin) {
    Toast.show({
      type: 'info',
      text1: '이미 로그인된 상태입니다.',
      position: 'bottom',
    });
      // 메인 화면으로 이동
      navigation.reset({
        index: 0,
        routes: [{ name: 'AuthHome' }],
      });
  }
  }, [isLogin, navigation]);

  const handleLogin = async () => {
    try {
      setIsLoading(true);
      console.log('로그인 시도 전 입력값:', { id, password });
      
      const response = await login(id, password);
      console.log('로그인 응답:', response);
      
      if (!response.success) {
        console.log('로그인 실패:', response);
        throw new Error(response.error?.message || '로그인에 실패했습니다.');
      }

        // 사용자 정보 저장
      const responseData = response.data;
      console.log('로그인 응답 데이터 구조:', responseData);
      console.log('responseData.id:', responseData.id);
      console.log('responseData.user_id:', responseData.user_id);
      
      const userData = {
        user_id: responseData.user_id || responseData.id, // user_id가 없으면 id 사용
        name: responseData.name,
        role: responseData.role,
        group_id: responseData.group_id,
        group_name: responseData.group_name,
        k_uid: responseData.k_uid,
        birthDate: responseData.birthDate,
        age: responseData.age,  
        took_today: 0 // 그룹 기반에서는 number
      };

        console.log('저장할 사용자 정보:', userData);
        
        // AsyncStorage에 저장
        await AsyncStorage.setItem('@user', JSON.stringify(userData));
      
      // refresh_token 저장
      if (responseData.refreshToken) {
        await AsyncStorage.setItem('@refresh_token', responseData.refreshToken);
      }
      
        console.log('사용자 정보 저장 완료');
        
        // 저장된 정보 확인
        const storedUser = await AsyncStorage.getItem('@user');
        console.log('저장된 사용자 정보 확인:', storedUser);
        
        if (!storedUser) {
          throw new Error('사용자 정보 저장 실패');
        }

        // 저장된 사용자 정보 파싱하여 필수 필드 확인
        const parsedUser = JSON.parse(storedUser);
        console.log('파싱된 사용자 정보:', parsedUser);
                
        if (!parsedUser.group_id) {
        throw new Error('사용자 정보에 그룹 ID가 없습니다.');
        }

      if (!parsedUser.role) {
          throw new Error('사용자 계정 타입이 없습니다.');
        }
        
        Toast.show({
          type: 'success',
          text1: '로그인 성공',
          text2: '로그인되었습니다.',
          position: 'bottom',
        });

      // 로그인 성공 후 입력 필드 초기화
      setId('');
      setPassword('');
      setIdError('');
      setPasswordError('');
      setIdTouched(false);
      setPasswordTouched(false);
      setLoginError('');

      // 메인 화면으로 이동
      navigation.reset({
        index: 0,
        routes: [{ name: 'AuthHome' }],
      });
    } catch (error: any) {
      console.error('로그인 에러:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      
      Toast.show({
        type: 'error',
        text1: '오류',
        text2: error.message || '로그인 중 오류가 발생했습니다.',
        position: 'bottom',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignup = async () => {
    if (!id || !password || !name || !birthDate || !age) {
      Toast.show({
        type: 'error',
        text1: '입력 오류',
        text2: '모든 필드를 입력해주세요.',
        position: 'bottom',
      });
      return;
    }

    try {
      setIsLoading(true);
      console.log('회원가입 시도:', {
        user_id: id,
        password,
        name,
        birthDate,
        age: Number(age),
        role: accountType as 'parent' | 'child',
        connect: id,
        took_today: 0
      });

      const response = await signup({
        user_id: id,
        password,
        name,
        birthDate,
        age: Number(age),
        role: accountType as 'parent' | 'child',
        group_name: accountType === 'parent' ? '가족' : undefined,
        parent_user_id: accountType === 'child' ? id : undefined,
        took_today: 0
      });
      console.log('회원가입 응답:', response);

      if (response && response.success) {
        Toast.show({
          type: 'success',
          text1: '회원가입 완료',
          text2: '로그인 화면으로 이동합니다.',
          position: 'bottom',
        });
        
        // 입력 필드 초기화
        setId('');
        setPassword('');
        setName('');
        setBirthDate('');
        setAge('');
        setAccountType('parent');
        setConnect('');
        
        // 로그인 화면으로 이동
        navigation.navigate(authNavigations.LOGIN);
      } else {
        Toast.show({
          type: 'error',
          text1: '회원가입 실패',
          text2: response?.error?.message || '회원가입에 실패했습니다.',
          position: 'bottom',
        });
      }
    } catch (error) {
      console.error('회원가입 에러:', error);
      Toast.show({
        type: 'error',
        text1: '오류',
        text2: error instanceof Error ? error.message : '회원가입 중 오류가 발생했습니다.',
        position: 'bottom',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>Teddy Bear</Text>
        </View>

        <View style={styles.form}>
          <InputField
            label="아이디"
            value={id}
            onChangeText={setId}
            placeholder="아이디를 입력해주세요."
            error={idError}
            touched={idTouched}
            onBlur={() => setIdTouched(true)}
          />

          <InputField
            label="비밀번호"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="비밀번호를 입력해주세요."
            error={passwordError}
            touched={passwordTouched}
            onBlur={() => setPasswordTouched(true)}
          />

        <View style={styles.buttonContainer}>
          <CustomButton
            label={isLoading ? "로그인 중..." : "로그인"}
            onPress={handleLogin}
            disabled={isLoading}
          />
        </View>

        {/* 에러 메시지 안내 */}
        {loginError ? (
          <Text style={styles.errorText}>{loginError}</Text>
        ) : null}

        <View style={styles.signupContainer}>
          <Text style={styles.signupText}>계정이 없으신가요? </Text>
          <TouchableOpacity onPress={() => navigation.navigate(authNavigations.SIGNUP)}>
            <Text style={styles.signupLink}>회원가입</Text>
          </TouchableOpacity>
        </View>
      </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: -20,
  },
  title: {
    color: colors.BLACK,
    fontSize: 40,
    fontWeight: 'bold',
    marginTop: 170,
    marginBottom: 55,
  },
  form: {
    // Add any necessary styles for the form
  },
  buttonContainer: {
    marginTop: 10,
    marginBottom: 20,
  },
  errorText: {
    color: colors.DANGER.DEFAULT,
    marginTop: 8,
    textAlign: 'center',
  },
  signupContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
  },
  signupText: {
    color: colors.BLACK,
    fontSize: 14,
  },
  signupLink: {
    color: colors.PRIMARY.DEFAULT,
    fontSize: 14,
    fontWeight: 'bold',
  },
});

export default LoginScreen;