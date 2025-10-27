import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import colors from '../../constants/colors';
import InputField from '../../components/InputField';
import CustomButton from '../../components/CustomButton';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../types/navigation';
import { authNavigations } from '../../constants/navigation';
import { useAuth } from '../../contexts/AuthContext';
import Toast from 'react-native-toast-message';
import Feather from 'react-native-vector-icons/Feather';
import { Camera, CameraType } from 'react-native-camera-kit';
import { SignupData } from '../../types/auth';

type NavigationProp = NativeStackNavigationProp<AuthStackParamList>;

const SignupScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProp<AuthStackParamList, 'Signup'>>();
  const { signup } = useAuth();

  const [id, setId] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [age, setAge] = useState('');
  const [accountType, setAccountType] = useState<'parent' | 'child'>('parent');
  const [parentUserId, setParentUserId] = useState('');
  const [groupName, setGroupName] = useState('');
  const [idError, setIdError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');
  const [nameError, setNameError] = useState('');
  const [birthDateError, setBirthDateError] = useState('');
  const [ageError, setAgeError] = useState('');
  const [parentUserIdError, setParentUserIdError] = useState('');
  const [groupNameError, setGroupNameError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [idTouched, setIdTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [confirmPasswordTouched, setConfirmPasswordTouched] = useState(false);
  const [nameTouched, setNameTouched] = useState(false);
  const [birthDateTouched, setBirthDateTouched] = useState(false);
  const [parentUserIdTouched, setParentUserIdTouched] = useState(false);
  const [groupNameTouched, setGroupNameTouched] = useState(false);
  const [showScanner, setShowScanner] = useState(false);

  const calculateAge = (birthDate: string) => {
    try {
      if (!birthDate || !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) {
        return '';
      }

      const [year, month, day] = birthDate.split('-').map(Number);
      const birth = new Date(year, month - 1, day);
      const today = new Date();

      if (birth > today) {
        return '';
      }

      let age = today.getFullYear() - birth.getFullYear();
      const monthDiff = today.getMonth() - birth.getMonth();
      
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
        age--;
      }

      return age.toString();
    } catch (error) {
      return '';
    }
  };

  const formatBirthDate = (text: string) => {
    const numbers = text.replace(/[^\d-]/g, '');
    
    const cleanNumbers = numbers.replace(/-/g, '');
    
    if (cleanNumbers.length > 8) {
      return cleanNumbers.slice(0, 8);
    }
    
    let formatted = '';
    if (cleanNumbers.length > 0) {
      formatted += cleanNumbers.slice(0, 4);
    }
    if (cleanNumbers.length > 4) {
      formatted += '-' + cleanNumbers.slice(4, 6);
    }
    if (cleanNumbers.length > 6) {
      formatted += '-' + cleanNumbers.slice(6, 8);
    }
    
    return formatted;
  };

  const handleBirthDateChange = (text: string) => {
    const formattedDate = formatBirthDate(text);
    setBirthDate(formattedDate);
    
    if (formattedDate.length === 10) {
      const calculatedAge = calculateAge(formattedDate);
      setAge(calculatedAge);
    } else {
      setAge('');
    }
  };

  useEffect(() => {
    if (birthDate.length === 10) {
      const calculatedAge = calculateAge(birthDate);
      setAge(calculatedAge);
      setAgeError('');
    } else {
      setAge('');
    }
  }, [birthDate]);

  const handleBarCodeScanned = (event: { nativeEvent: { codeStringValue: string } }) => {
    setShowScanner(false);
    
    const rawData = event.nativeEvent.codeStringValue;
    console.log('🔍 원본 QR 데이터:', rawData);
    
    try {
      // QR 데이터가 JSON인지 확인
      const qrData = JSON.parse(rawData);
      console.log('QR 스캔 데이터:', qrData);
      
      // 부모 계정 ID 추출 (data 필드 우선 체크)
      let parentId = qrData.data || qrData.user_id || qrData.connect || qrData.id;
      
      // 🔥 띄어쓰기 제거 처리
      if (typeof parentId === 'string') {
        parentId = parentId.replace(/\s+/g, '');
        console.log('🔧 띄어쓰기 제거된 부모 ID:', parentId);
      }
      
      if (!parentId) {
        throw new Error('QR 코드에서 부모 계정 ID를 찾을 수 없습니다.');
      }
      
      setParentUserId(parentId);
      setAccountType('child');
      Toast.show({
        type: 'success',
        text1: 'QR 코드 스캔 완료',
        text2: `부모 계정 ID: ${parentId}`,
        position: 'bottom',
      });
    } catch (error) {
      // JSON 파싱 실패 시 단순 문자열로 처리
      console.log('단순 문자열 QR 데이터:', rawData);
      
      // 🔥 띄어쓰기 제거 처리
      const cleanedData = rawData.replace(/\s+/g, '');
      console.log('🔧 띄어쓰기 제거된 데이터:', cleanedData);
      
      setParentUserId(cleanedData);
      setAccountType('child');
      Toast.show({
        type: 'success',
        text1: 'QR 코드 스캔 완료',
        text2: '부모 계정 ID가 입력되었습니다.',
        position: 'bottom',
      });
    }
  };

  const validateId = (value: string) => {
    if (!value.trim()) {
      setIdError('아이디를 입력해주세요');
      return false;
    }
    setIdError('');
    return true;
  };

  const validatePassword = (value: string) => {
    if (!value.trim()) {
      setPasswordError('비밀번호를 입력해주세요');
      return false;
    }
    if (value.length < 6) {
      setPasswordError('비밀번호는 6자 이상이어야 합니다');
      return false;
    }
    setPasswordError('');
    return true;
  };

  const validateConfirmPassword = (value: string) => {
    if (!value.trim()) {
      setConfirmPasswordError('비밀번호 확인을 입력해주세요');
      return false;
    }
    if (value !== password) {
      setConfirmPasswordError('비밀번호가 일치하지 않습니다');
      return false;
    }
    setConfirmPasswordError('');
    return true;
  };

  const validateName = (value: string) => {
    if (!value.trim()) {
      setNameError('이름을 입력해주세요');
      return false;
    }
    setNameError('');
    return true;
  };

  const validateBirthDate = (value: string) => {
    if (!value.trim()) {
      setBirthDateError('생년월일을 입력해주세요');
      return false;
    }
    
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      setBirthDateError('생년월일은 YYYY-MM-DD 형식이어야 합니다');
      return false;
    }

    const [year, month, day] = value.split('-').map(Number);
    
    // 연도 범위 검사 (예: 1900년 ~ 현재)
    const currentYear = new Date().getFullYear();
    if (year < 1900 || year > currentYear) {
      setBirthDateError('유효한 연도를 입력해주세요');
      return false;
    }

    // 월 검사
    if (month < 1 || month > 12) {
      setBirthDateError('유효한 월을 입력해주세요');
      return false;
    }

    // 일 검사
    const daysInMonth = new Date(year, month, 0).getDate();
    if (day < 1 || day > daysInMonth) {
      setBirthDateError('유효한 일을 입력해주세요');
      return false;
    }

    setBirthDateError('');
    return true;
  };

  const validateAge = (value: string) => {
    if (!value.trim()) {
      setAgeError('나이를 입력해주세요');
      return false;
    }
    const ageNum = parseInt(value);
    if (isNaN(ageNum) || ageNum < 0 || ageNum > 120) {
      setAgeError('유효한 나이를 입력해주세요');
      return false;
    }
    setAgeError('');
    return true;
  };

  const validateParentUserId = (value: string) => {
    if (accountType === 'child' && !value.trim()) {
      setParentUserIdError('부모 계정 ID를 입력해주세요');
      return false;
    }
    setParentUserIdError('');
    return true;
  };

  const validateGroupName = (value: string) => {
    if (accountType === 'parent' && !value.trim()) {
      setGroupNameError('가족 그룹명을 입력해주세요');
      return false;
    }
    setGroupNameError('');
    return true;
  };

  const handleIdChange = (text: string) => {
    setId(text);
  };

  const handlePasswordChange = (text: string) => {
    setPassword(text);
    if (confirmPassword) {
      validateConfirmPassword(confirmPassword);
    }
  };

  const handleConfirmPasswordChange = (text: string) => {
    setConfirmPassword(text);
  };

  const handleNameChange = (text: string) => {
    setName(text);
  };

  const handleParentUserIdChange = (text: string) => {
    setParentUserId(text);
    validateParentUserId(text);
  };

  const handleGroupNameChange = (text: string) => {
    setGroupName(text);
    validateGroupName(text);
  };

  const handleSignup = async () => {
    try {
      setIsLoading(true);

      // 모든 필드 유효성 검사
    const isIdValid = validateId(id);
    const isPasswordValid = validatePassword(password);
    const isConfirmPasswordValid = validateConfirmPassword(confirmPassword);
    const isNameValid = validateName(name);
    const isBirthDateValid = validateBirthDate(birthDate);
      const isAgeValid = validateAge(age);
          const isParentUserIdValid = accountType === 'child' ? validateParentUserId(parentUserId) : true;
    const isGroupNameValid = accountType === 'parent' ? validateGroupName(groupName) : true;

    if (!isIdValid || !isPasswordValid || !isConfirmPasswordValid || 
        !isNameValid || !isBirthDateValid || !isAgeValid || !isParentUserIdValid || !isGroupNameValid) {
      return;
    }

      const signupData: SignupData = {
        user_id: id,
        password,
        name,
        birthDate,
        age: parseInt(age),
        role: accountType,
        group_name: accountType === 'parent' ? groupName : undefined,
        parent_user_id: accountType === 'child' ? parentUserId : undefined,
        took_today: 0
      };

      const response = await signup(signupData);

      if (response.success) {
      Toast.show({
        type: 'success',
        text1: '회원가입 성공',
        text2: '로그인 화면으로 이동합니다.',
        position: 'bottom',
      });
      navigation.navigate(authNavigations.LOGIN);
      } else {
        Toast.show({
          type: 'error',
          text1: '회원가입 실패',
          text2: response.error?.message || '회원가입에 실패했습니다.',
          position: 'bottom',
        });
      }
    } catch (error: any) {
      console.error('회원가입 에러:', error);
      Toast.show({
        type: 'error',
        text1: '회원가입 실패',
        text2: error.message || '회원가입에 실패했습니다.',
        position: 'bottom',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidingView}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <View style={styles.headerRow}>
              <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                <Feather name="arrow-left" size={24} color={colors.BLACK} />
              </TouchableOpacity>
              <Text style={styles.title}>회원가입</Text>
            </View>

            <View style={styles.form}>
              <InputField
                label="아이디"
                value={id}
                placeholder="아이디를 입력해주세요"
                onChangeText={handleIdChange}
                onBlur={() => {
                  setIdTouched(true);
                  validateId(id);
                }}
                error={idError}
                touched={idTouched}
              />

              <InputField
                label="비밀번호"
                value={password}
                placeholder="비밀번호를 입력해주세요"
                onChangeText={handlePasswordChange}
                onBlur={() => {
                  setPasswordTouched(true);
                  validatePassword(password);
                }}
                secureTextEntry
                error={passwordError}
                touched={passwordTouched}
              />

              <InputField
                label="비밀번호 확인"
                value={confirmPassword}
                placeholder="비밀번호 확인"
                onChangeText={handleConfirmPasswordChange}
                onBlur={() => {
                  setConfirmPasswordTouched(true);
                  validateConfirmPassword(confirmPassword);
                }}
                secureTextEntry
                error={confirmPasswordError}
                touched={confirmPasswordTouched}
              />

              <InputField
                label="이름"
                value={name}
                placeholder="이름을 입력해주세요"
                onChangeText={handleNameChange}
                onBlur={() => {
                  setNameTouched(true);
                  validateName(name);
                }}
                error={nameError}
                touched={nameTouched}
              />

              <InputField
                label="생년월일 (YYYY-MM-DD)"
                value={birthDate}
                onChangeText={handleBirthDateChange}
                onBlur={() => {
                  setBirthDateTouched(true);
                  validateBirthDate(birthDate);
                }}
                error={birthDateError}
                touched={birthDateTouched}
                placeholder="예: 1990-01-01"
                keyboardType="numeric"
                maxLength={10}
              />

              <InputField
                label="나이"
                value={age}
                onChangeText={setAge}
                error={ageError}
                keyboardType="numeric"
                editable={false}
                placeholder="생년월일을 입력하면 자동으로 계산됩니다"
              />

              <View style={styles.accountTypeContainer}>
                <Text style={styles.accountTypeLabel}>계정 유형</Text>
                <View style={styles.accountTypeButtons}>
                  <TouchableOpacity
                    style={[
                      styles.accountTypeButton,
                      accountType === 'parent' && styles.selectedAccountType,
                    ]}
                    onPress={() => {
                      setAccountType('parent');
                          setParentUserId('');
    setGroupName('');
    setParentUserIdError('');
    setGroupNameError('');
                    }}
                  >
                    <Text
                      style={[
                        styles.accountTypeText,
                        accountType === 'parent' && styles.selectedAccountTypeText,
                      ]}
                    >
                      메인 계정
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.accountTypeButton,
                      accountType === 'child' && styles.selectedAccountType,
                    ]}
                    onPress={() => {
                      setAccountType('child');
                      validateParentUserId(parentUserId);
    validateGroupName(groupName);
                    }}
                  >
                    <Text
                      style={[
                        styles.accountTypeText,
                        accountType === 'child' && styles.selectedAccountTypeText,
                      ]}
                    >
                      자식 계정
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {accountType === 'child' && (
                <View style={styles.connectContainer}>
                  <InputField
                    label="부모 계정 ID"
                    value={parentUserId}
                    onChangeText={handleParentUserIdChange}
                    placeholder="부모 계정의 ID를 입력하세요"
                    error={parentUserIdError}
                    onBlur={() => setParentUserIdTouched(true)}
                    touched={parentUserIdTouched}
                  />
                  <TouchableOpacity
                    style={styles.scanButton}
                    onPress={() => setShowScanner(true)}
                  >
                    <Feather name="camera" size={20} color={colors.WHITE} />
                    <Text style={styles.scanButtonText}>QR 스캔</Text>
                  </TouchableOpacity>
                </View>
              )}

              {accountType === 'parent' && (
                <InputField
                  label="가족 그룹명"
                  value={groupName}
                  onChangeText={handleGroupNameChange}
                  placeholder="가족 그룹 이름을 입력하세요"
                  error={groupNameError}
                  onBlur={() => setGroupNameTouched(true)}
                  touched={groupNameTouched}
                />
              )}

              <View style={styles.buttonContainer}>
                <CustomButton
                  label={isLoading ? "회원가입 중..." : "회원가입"}
                  onPress={handleSignup}
                  disabled={isLoading}
                />
              </View>

              <View style={styles.loginContainer}>
                <Text style={styles.loginText}>이미 계정이 있으신가요?</Text>
                <TouchableOpacity style={styles.loginButton} onPress={() => navigation.navigate(authNavigations.LOGIN)}>
                  <Text style={styles.loginLink}>로그인</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>

      {showScanner && (
        <View style={styles.scannerContainer}>
          <Camera
            cameraType={CameraType.Back}
            scanBarcode={true}
            onReadCode={(event) => {
              setShowScanner(false);
              
              const rawData = event.nativeEvent.codeStringValue;
              console.log('🔍 원본 QR 데이터:', rawData);
              
              try {
                // QR 데이터가 JSON인지 확인
                const qrData = JSON.parse(rawData);
                console.log('QR 스캔 데이터:', qrData);
                
                // 부모 계정 ID 추출 (data 필드 우선 체크)
                let parentId = qrData.data || qrData.user_id || qrData.connect || qrData.id;
                
                // 🔥 띄어쓰기 제거 처리
                if (typeof parentId === 'string') {
                  parentId = parentId.replace(/\s+/g, '');
                  console.log('🔧 띄어쓰기 제거된 부모 ID:', parentId);
                }
                
                if (!parentId) {
                  throw new Error('QR 코드에서 부모 계정 ID를 찾을 수 없습니다.');
                }
                
                  setParentUserId(parentId);
                Toast.show({
                  type: 'success',
                  text1: 'QR 코드 스캔 완료',
                  text2: `부모 계정 ID: ${parentId}`,
                  position: 'bottom',
                });
              } catch (error) {
                // JSON 파싱 실패 시 단순 문자열로 처리
                console.log('단순 문자열 QR 데이터:', rawData);
                
                // 🔥 띄어쓰기 제거 처리
                const cleanedData = rawData.replace(/\s+/g, '');
                console.log('🔧 띄어쓰기 제거된 데이터:', cleanedData);
                
                setParentUserId(cleanedData);
                Toast.show({
                  type: 'success',
                  text1: 'QR 코드 스캔 완료',
                  text2: '부모 계정 ID가 입력되었습니다.',
                  position: 'bottom',
                });
              }
            }}
            showFrame={true}
            laserColor={colors.PRIMARY.DEFAULT}
            frameColor={colors.PRIMARY.DEFAULT}
            style={{ flex: 1 }}
          />
          <TouchableOpacity
            style={styles.closeScannerButton}
            onPress={() => setShowScanner(false)}
          >
            <Feather name="x" size={24} color={colors.WHITE} />
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.WHITE,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    color: colors.BLACK,
    fontSize: 24,
    fontWeight: 'bold',
  },
  form: {
    flex: 1,
  },
  accountTypeContainer: {
    marginBottom: 20,
  },
  accountTypeLabel: {
    color: colors.BLACK,
    fontSize: 16,
    marginBottom: 8,
  },
  accountTypeButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  accountTypeButton: {
    flex: 1,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.GRAY.DEFAULT,
    alignItems: 'center',
  },
  selectedAccountType: {
    backgroundColor: colors.PRIMARY.DEFAULT,
    borderColor: colors.PRIMARY.DEFAULT,
  },
  accountTypeText: {
    color: colors.BLACK,
    fontSize: 16,
  },
  selectedAccountTypeText: {
    color: colors.WHITE,
    fontWeight: 'bold',
  },
  connectContainer: {
    marginBottom: 20,
  },
  buttonContainer: {
    marginTop: 20,
  },
  loginContainer: {
    alignItems: 'center',
    marginTop: 10,
  },
  loginText: {
    color: colors.BLACK,
    fontSize: 14,
    marginBottom: 4,
  },
  loginButton: {
    alignSelf: 'center',
    marginBottom: 20,
  },
  loginLink: {
    color: colors.PRIMARY.DEFAULT,
    fontSize: 14,
    fontWeight: 'bold',
  },
  scannerContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'black',
  },
  closeScannerButton: {
    position: 'absolute',
    top: 40,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    padding: 12,
    borderRadius: 30,
  },
  scanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.PRIMARY.DEFAULT,
    padding: 10,
    borderRadius: 8,
    marginTop: 8,
  },
  scanButtonText: {
    color: colors.WHITE,
    marginLeft: 8,
    fontSize: 16,
  },
});

export default SignupScreen;