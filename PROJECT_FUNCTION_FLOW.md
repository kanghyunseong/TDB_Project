# TDB 프로젝트 기능별 상세 흐름 문서

## 목차
1. [인증 및 사용자 관리](#1-인증-및-사용자-관리)
2. [약물 검색 및 저장](#2-약물-검색-및-저장)
3. [스케줄 관리](#3-스케줄-관리)
4. [복용 완료 처리](#4-복용-완료-처리)
5. [약물 상호작용 검사](#5-약물-상호작용-검사)
6. [데이터 조회](#6-데이터-조회)
7. [사용자 선택 및 멤버 관리](#7-사용자-선택-및-멤버-관리)

---

## 1. 인증 및 사용자 관리

### 1.1 로그인 프로세스

#### 1.1.1 사용자 입력
- **위치**: `src/screens/auth/LoginScreen.tsx`
- **함수**: `handleLogin()`
- **입력값**:
  - `id: string` - 사용자 아이디
  - `password: string` - 비밀번호

#### 1.1.2 입력 유효성 검사
- **위치**: `src/screens/auth/LoginScreen.tsx`
- **검사 항목**:
  - `id.trim()` - 아이디 공백 제거 후 확인
  - `password.trim()` - 비밀번호 공백 제거 후 확인
- **에러 처리**:
  - 빈 값이면 `idError` 또는 `passwordError` 상태 업데이트
  - `Toast.show()` 에러 메시지 표시

#### 1.1.3 API 호출
- **위치**: `src/contexts/AuthContext.tsx`
- **함수**: `login(id: string, password: string)`
- **내부 호출**: `apiLogin(id, password)`
- **API 엔드포인트**: `POST /api/auth/login`
- **요청 데이터**:
  ```json
  {
    "user_id": "사용자_아이디",
    "password": "비밀번호"
  }
  ```
- **응답 데이터**:
  ```json
  {
    "success": true,
    "data": {
      "accessToken": "JWT_토큰",
      "refreshToken": "리프레시_토큰",
      "user_id": "사용자_ID",
      "name": "사용자_이름",
      "role": "parent" | "child",
      "group_id": "그룹_ID",
      "group_name": "그룹_이름",
      "k_uid": "카카오_UID",
      "birthDate": "1990-01-01",
      "age": 34
    }
  }
  ```

#### 1.1.4 토큰 저장
- **위치**: `src/contexts/AuthContext.tsx`
- **함수**: `login()` 내부
- **저장 위치**: AsyncStorage
- **저장 키값**:
  - `@accessToken` → `accessToken` 값 저장
  - `@refreshToken` → `refreshToken` 값 저장
  - `@user` → 사용자 정보 JSON 문자열로 저장
- **저장 데이터**:
  ```json
  {
    "user_id": "사용자_ID",
    "name": "사용자_이름",
    "age": 34,
    "birthDate": "1990-01-01",
    "k_uid": "카카오_UID",
    "took_today": 0,
    "group_id": "그룹_ID",
    "role": "parent",
    "group_name": "그룹_이름",
    "accessToken": "JWT_토큰",
    "refreshToken": "리프레시_토큰"
  }
  ```

#### 1.1.5 상태 업데이트
- **위치**: `src/contexts/AuthContext.tsx`
- **업데이트되는 상태**:
  - `setUser(userData)` - 사용자 정보 저장
  - `setToken(accessToken)` - 액세스 토큰 저장
  - `setIsLogin(true)` - 로그인 상태 활성화

#### 1.1.6 화면 전환
- **위치**: `src/screens/auth/LoginScreen.tsx`
- **함수**: `navigation.reset()`
- **전환 대상**: `AuthHome` 화면
- **전환 방식**: 스택 초기화 후 이동

---

### 1.2 회원가입 프로세스

#### 1.2.1 사용자 입력
- **위치**: `src/screens/auth/SignupScreen.tsx`
- **입력 필드**:
  - `id: string` - 아이디
  - `password: string` - 비밀번호
  - `confirmPassword: string` - 비밀번호 확인
  - `name: string` - 이름
  - `birthDate: string` - 생년월일 (YYYY-MM-DD)
  - `age: string` - 나이 (자동 계산)
  - `accountType: 'parent' | 'child'` - 계정 유형
  - `parentUserId: string` - 보호자 계정 ID (자녀 계정인 경우)
  - `groupName: string` - 가족 그룹명 (부모 계정인 경우)

#### 1.2.2 실시간 유효성 검사
- **위치**: `src/screens/auth/SignupScreen.tsx`
- **검사 함수들**:

##### validateId(value: string)
- **검사 항목**: `value.trim()` - 공백 제거 후 확인
- **에러**: 빈 값이면 `setIdError('아이디를 입력해주세요')`
- **성공**: `setIdError('')` - 에러 초기화

##### validatePassword(value: string)
- **검사 항목**:
  1. `value.trim()` - 공백 제거 후 확인
  2. `value.length < 6` - 최소 6자 이상
- **에러**:
  - 빈 값: `setPasswordError('비밀번호를 입력해주세요')`
  - 6자 미만: `setPasswordError('비밀번호는 6자 이상이어야 합니다')`
- **성공**: `setPasswordError('')`

##### validateConfirmPassword(value: string)
- **검사 항목**:
  1. `value.trim()` - 공백 제거 후 확인
  2. `value !== password` - 비밀번호 일치 확인
- **에러**:
  - 빈 값: `setConfirmPasswordError('비밀번호 확인을 입력해주세요')`
  - 불일치: `setConfirmPasswordError('비밀번호가 일치하지 않습니다')`
- **성공**: `setConfirmPasswordError('')`

##### validateName(value: string)
- **검사 항목**: `value.trim()` - 공백 제거 후 확인
- **에러**: 빈 값이면 `setNameError('이름을 입력해주세요')`
- **성공**: `setNameError('')`

##### validateBirthDate(value: string)
- **검사 항목**:
  1. `value.trim()` - 공백 제거
  2. `/^\d{4}-\d{2}-\d{2}$/.test(value)` - YYYY-MM-DD 형식 확인
  3. `year < 1900 || year > currentYear` - 연도 범위 확인
  4. `month < 1 || month > 12` - 월 범위 확인
  5. `day < 1 || day > daysInMonth` - 일 범위 확인
- **에러**:
  - 빈 값: `setBirthDateError('생년월일을 입력해주세요')`
  - 형식 오류: `setBirthDateError('생년월일은 YYYY-MM-DD 형식이어야 합니다')`
  - 연도 오류: `setBirthDateError('유효한 연도를 입력해주세요')`
  - 월/일 오류: `setBirthDateError('유효한 월/일을 입력해주세요')`
- **성공**: `setBirthDateError('')`

##### validateAge(value: string)
- **검사 항목**:
  1. `value.trim()` - 공백 제거
  2. `parseInt(value)` - 숫자 변환
  3. `ageNum < 0 || ageNum > 120` - 나이 범위 확인
- **에러**:
  - 빈 값: `setAgeError('나이를 입력해주세요')`
  - 범위 오류: `setAgeError('유효한 나이를 입력해주세요')`
- **성공**: `setAgeError('')`

##### validateParentUserId(value: string)
- **검사 조건**: `accountType === 'child'` 일 때만 검사
- **검사 항목**: `value.trim()` - 공백 제거 후 확인
- **에러**: 빈 값이면 `setParentUserIdError('보호자 계정 ID를 입력해주세요')`
- **성공**: `setParentUserIdError('')`

##### validateGroupName(value: string)
- **검사 조건**: `accountType === 'parent'` 일 때만 검사
- **검사 항목**: `value.trim()` - 공백 제거 후 확인
- **에러**: 빈 값이면 `setGroupNameError('가족 그룹명을 입력해주세요')`
- **성공**: `setGroupNameError('')`

#### 1.2.3 생년월일 자동 계산
- **위치**: `src/screens/auth/SignupScreen.tsx`
- **함수**: `calculateAge(birthDate: string)`
- **계산 로직**:
  1. `birthDate`를 `-`로 분리하여 `[year, month, day]` 추출
  2. `new Date(year, month - 1, day)` - 생년월일 Date 객체 생성
  3. `new Date()` - 오늘 날짜
  4. `today.getFullYear() - birth.getFullYear()` - 연도 차이 계산
  5. 월/일 차이 확인하여 나이 조정
- **반환값**: `age.toString()` - 계산된 나이 문자열

#### 1.2.4 QR 코드 스캔 (자녀 계정)
- **위치**: `src/screens/auth/SignupScreen.tsx`
- **함수**: `handleBarCodeScanned(event)`
- **처리 과정**:
  1. `event.nativeEvent.codeStringValue` - QR 코드 원본 데이터 추출
  2. `JSON.parse(rawData)` - JSON 파싱 시도
  3. **성공 시**:
     - `qrData.data || qrData.user_id || qrData.connect || qrData.id` - 보호자 ID 추출
     - `parentId.replace(/\s+/g, '')` - 띄어쓰기 제거
     - `setParentUserId(parentId)` - 보호자 ID 설정
     - `setAccountType('child')` - 계정 타입 설정
  4. **실패 시** (단순 문자열):
     - `rawData.replace(/\s+/g, '')` - 띄어쓰기 제거
     - `setParentUserId(cleanedData)` - 보호자 ID 설정
     - `setAccountType('child')` - 계정 타입 설정

#### 1.2.5 회원가입 API 호출
- **위치**: `src/contexts/AuthContext.tsx`
- **함수**: `signup(data)`
- **내부 호출**: `apiSignup(signupData)`
- **API 엔드포인트**: `POST /api/auth/signup`
- **요청 데이터**:
  ```json
  {
    "user_id": "아이디",
    "password": "비밀번호",
    "name": "이름",
    "birthDate": "1990-01-01",
    "age": 34,
    "role": "parent" | "child",
    "group_name": "가족_그룹명" (부모인 경우),
    "parent_user_id": "보호자_ID" (자녀인 경우),
    "took_today": 0
  }
  ```
- **응답 데이터**:
  ```json
  {
    "success": true,
    "data": {
      "message": "회원가입이 완료되었습니다. 로그인해주세요.",
      "user_id": "아이디"
    }
  }
  ```

#### 1.2.6 성공 처리
- **위치**: `src/screens/auth/SignupScreen.tsx`
- **처리 과정**:
  1. `Toast.show()` - 성공 메시지 표시
  2. 모든 입력 필드 초기화 (`setId('')`, `setPassword('')` 등)
  3. `navigation.navigate('Login')` - 로그인 화면으로 이동

---

### 1.3 토큰 갱신 프로세스

#### 1.3.1 토큰 만료 감지
- **위치**: `src/api/client.ts`
- **감지 조건**: API 응답 `status === 401`
- **처리**: `refreshToken()` 함수 호출

#### 1.3.2 리프레시 토큰 조회
- **위치**: `src/api/client.ts`
- **함수**: `refreshToken()`
- **조회**: `AsyncStorage.getItem('@refreshToken')`
- **에러 처리**: 리프레시 토큰이 없으면 에러 throw

#### 1.3.3 토큰 갱신 API 호출
- **위치**: `src/api/client.ts`
- **API 엔드포인트**: `POST /api/auth/refresh-token`
- **요청 데이터**:
  ```json
  {
    "token": "리프레시_토큰"
  }
  ```
- **요청 헤더**:
  ```
  Authorization: Bearer {리프레시_토큰}
  Content-Type: application/json
  ```
- **응답 데이터**:
  ```json
  {
    "success": true,
    "data": {
      "access_token": "새로운_액세스_토큰",
      "refresh_token": "새로운_리프레시_토큰"
    }
  }
  ```

#### 1.3.4 새 토큰 저장
- **위치**: `src/api/client.ts`
- **저장**:
  - `AsyncStorage.setItem('@accessToken', accessToken)`
  - `AsyncStorage.setItem('@refreshToken', newRefreshToken)`

#### 1.3.5 원래 요청 재시도
- **위치**: `src/api/client.ts`
- **처리**:
  1. `originalRequest.headers.Authorization = Bearer ${newToken}`
  2. `apiClient(originalRequest)` - 원래 요청 재실행

---

## 2. 약물 검색 및 저장

### 2.1 약물 검색 프로세스

#### 2.1.1 검색어 입력
- **위치**: `src/screens/MedicineSearchScreen.tsx`
- **상태**: `searchQuery: string`
- **입력 이벤트**: `onChangeText={setSearchQuery}`

#### 2.1.2 검색 타입 선택
- **위치**: `src/screens/MedicineSearchScreen.tsx`
- **상태**: `searchType: 'medicine' | 'supplement'`
- **기본값**: `'medicine'` (의약품)

#### 2.1.3 검색 실행
- **위치**: `src/screens/MedicineSearchScreen.tsx`
- **함수**: `handleSearch()`
- **검사 항목**:
  - `searchQuery.trim()` - 검색어 공백 제거 후 확인
  - 빈 값이면 `setError('검색어를 입력해주세요.')` 후 종료

#### 2.1.4 의약품 검색 API 호출
- **위치**: `src/screens/MedicineSearchScreen.tsx`
- **함수**: `searchMedicineMaster(searchQuery, 100)`
- **내부 호출**: `src/api/medicineMaster.ts` → `searchMedicineMaster()`
- **API 엔드포인트**: `GET /api/medicine-master/search?query={검색어}&limit=100`
- **요청 헤더**:
  ```
  Authorization: Bearer {액세스_토큰}
  Content-Type: application/json
  ```
- **응답 데이터**:
  ```json
  {
    "success": true,
    "data": [
      {
        "report_no": "의약품_등록번호",
        "name": "의약품명",
        "company_name": "제조사명",
        "primary_function": "효능효과",
        "intake_method": "용법용량",
        "precautions": "주의사항",
        "storage_method": "보관방법"
      }
    ]
  }
  ```

#### 2.1.5 검색 결과 변환
- **위치**: `src/screens/MedicineSearchScreen.tsx`
- **변환 로직**:
  ```typescript
  const results = response.data.map((item: any) => ({
    medi_id: item.report_no || '',
    group_id: '',
    name: item.name || '',
    warning: 0,
    manufacturer: item.company_name || '',
    start_date: undefined,
    end_date: undefined,
    target_users: null,
    listed_only: 1,
    itemSeq: item.report_no || '',
    itemName: item.name || '',
    entpName: item.company_name || '',
    efcyQesitm: item.primary_function || '',
    useMethodQesitm: item.intake_method || '',
    atpnWarnQesitm: item.precautions || '',
    atpnQesitm: item.precautions || '',
    depositMethodQesitm: item.storage_method || ''
  }));
  ```
- **상태 업데이트**: `setMedicines(results)`

#### 2.1.6 건강기능식품 검색 API 호출
- **위치**: `src/screens/MedicineSearchScreen.tsx`
- **함수**: `searchTabletMaster(searchQuery, 100)`
- **내부 호출**: `src/api/medicineMaster.ts` → `searchTabletMaster()`
- **API 엔드포인트**: `GET /api/tablet-master/search?query={검색어}&limit=100`
- **응답 데이터**:
  ```json
  {
    "success": true,
    "data": [
      {
        "report_no": "건강기능식품_등록번호",
        "name": "제품명",
        "company_name": "제조사명",
        "raw_materials": "원료성분",
        "primary_function": "주요기능성",
        "intake_method": "섭취방법",
        "precautions": "복용시주의사항"
      }
    ]
  }
  ```

---

### 2.2 약물 저장 프로세스

#### 2.2.1 약물 상세 정보 입력
- **위치**: `src/screens/MedicineDetailScreen.tsx`
- **입력 필드**:
  - `name: string` - 약물명 (검색 결과에서 가져옴)
  - `start_date: string` - 복용 시작일 (YYYY-MM-DD)
  - `end_date: string` - 복용 종료일 (YYYY-MM-DD)
  - `totalQuantity: string` - 총 개수
  - `target_users: string[]` - 복용 대상 사용자 목록
  - `slot: number` - 디스펜서 슬롯 번호 (선택)

#### 2.2.2 입력 유효성 검사
- **위치**: `src/screens/MedicineDetailScreen.tsx`
- **검사 항목**:
  1. `name.trim()` - 약물명 필수
  2. `start_date` - 시작일 필수
  3. `end_date` - 종료일 필수
  4. `new Date(start_date) <= new Date(end_date)` - 날짜 유효성
  5. `totalQuantity` - 총 개수 필수
  6. `target_users.length > 0` - 복용 대상 선택 필수

#### 2.2.3 슬롯 자동 할당
- **위치**: `src/api/family.ts`
- **함수**: `saveMedicine(memberId, medicineData, medicineId)`
- **할당 로직**:
  1. `getMedicineList(memberId)` - 기존 약물 목록 조회
  2. `existingMedicines.map(med => med.slot)` - 사용 중인 슬롯 추출
  3. `userSelectedSlot` 확인:
     - 유효한 슬롯이면 해당 슬롯 사용
     - 이미 사용 중이면 에러 throw
  4. 유효한 슬롯이 없으면:
     - `availableSlot = 1`부터 시작
     - `while (usedSlots.includes(availableSlot))` - 사용 가능한 슬롯 찾기
     - `availableSlot++` - 다음 슬롯 확인
     - `availableSlot > MAX_SLOTS`면 에러 throw
  5. `medicineData.slot = availableSlot` - 슬롯 할당

#### 2.2.4 약물 저장 API 호출
- **위치**: `src/api/medicine.ts`
- **함수**: `saveMedicine(medicineData)`
- **내부 처리**:
  1. `getCurrentUser()` - 현재 사용자 정보 조회
  2. `getToken()` - 액세스 토큰 조회
  3. **API 엔드포인트**: `POST /api/medicine`
  4. **요청 데이터**:
     ```json
     {
       "medi_id": "medicine_{timestamp}",
       "name": "약물명",
       "warning": 0,
       "start_date": "2024-01-01",
       "end_date": "2024-12-31",
       "slot": 1,
       "target_users": ["user_id1", "user_id2"],
       "group_id": "그룹_ID",
       "type": "medicine"
     }
     ```
  5. **요청 헤더**:
     ```
     Authorization: Bearer {액세스_토큰}
     Content-Type: application/json
     ```

#### 2.2.5 서버 처리
- **위치**: `TDB_Server/src/medicine/medicine.service.ts`
- **함수**: `saveMedicine(userId, medicineData)`
- **처리 과정**:
  1. `getUserGroup(userId)` - 사용자 그룹 정보 조회
  2. `mediId = 'medicine_' + Date.now()` - 약물 ID 생성
  3. `medicineRepository.create()` - 약물 엔티티 생성
  4. `medicineRepository.save()` - 약물 저장
  5. `machineService.assignSlot()` - 슬롯 할당
  6. `machineService.reserveSlot()` - 슬롯 예약

#### 2.2.6 응답 처리
- **위치**: `src/api/medicine.ts`
- **응답 데이터**:
  ```json
  {
    "success": true,
    "data": {
      "medi_id": "medicine_1234567890",
      "name": "약물명",
      "group_id": "그룹_ID",
      "start_date": "2024-01-01",
      "end_date": "2024-12-31",
      "slot": 1,
      "target_users": ["user_id1", "user_id2"],
      "warning": 0
    }
  }
  ```
- **성공 처리**:
  1. `Toast.show()` - 성공 메시지 표시
  2. `navigation.goBack()` - 이전 화면으로 이동
  3. `navigation.setParams({ refresh: true })` - 목록 새로고침 플래그 설정

---

## 3. 스케줄 관리

### 3.1 스케줄 편집 화면 진입

#### 3.1.1 스케줄 버튼 클릭
- **위치**: `src/components/medicine/MedicineItem.tsx`
- **함수**: `handleSchedulePress()`
- **호출**: `onNavigateToSchedule(medicine)`

#### 3.1.2 네비게이션
- **위치**: `src/screens/MainHomeScreen.tsx`
- **함수**: `handleNavigateToSchedule(medicine)`
- **처리 과정**:
  1. `findMedicineMasterByName(medicine.name)` - 서버에서 처방 정보 조회
  2. `useMethodQesitm` 추출 - 용법용량 정보
  3. `navigation.navigate('MedicineScheduleEdit', {...})` - 스케줄 편집 화면 이동
  4. **전달 파라미터**:
     ```typescript
     {
       medicineId: medicine.medi_id,
       memberId: selectedMember.user_id,
       medicineName: medicine.name,
       useMethodQesitm: useMethodQesitm
     }
     ```

#### 3.1.3 기존 스케줄 조회
- **위치**: `src/screens/MedicineScheduleEditScreen.tsx`
- **함수**: `useEffect()` 내부
- **API 호출**: `getMedicineSchedule(medicineId, memberId)`
- **내부 호출**: `src/api/medicine.ts` → `getMedicineSchedule()`
- **API 엔드포인트**: `GET /api/schedule/medicine/{medicineId}?memberId={memberId}`
- **응답 데이터**:
  ```json
  {
    "success": true,
    "data": {
      "medi_id": "medicine_123",
      "user_id": "user_123",
      "schedule": {
        "mon": { "morning": true, "afternoon": false, "evening": true },
        "tue": { "morning": true, "afternoon": false, "evening": true },
        ...
      },
      "schedules": [
        {
          "day_of_week": "mon",
          "time_of_day": "morning",
          "dose_count": 1,
          "enabled": true
        },
        ...
      ],
      "totalQuantity": "100",
      "doseCount": "1",
      "morningDose": 1,
      "afternoonDose": 0,
      "eveningDose": 1,
      "slot": 1
    }
  }
  ```

#### 3.1.4 스케줄 데이터 변환
- **위치**: `src/screens/MedicineScheduleEditScreen.tsx`
- **변환 로직**:
  1. `schedules` 배열을 매트릭스 형식으로 변환
  2. `matrixSchedule[day][time] = { enabled: true, dose: dose_count }`
  3. 시간대별 복용량 추출:
     - `morningDose` → `timeDoses.morningDose`
     - `afternoonDose` → `timeDoses.afternoonDose`
     - `eveningDose` → `timeDoses.eveningDose`

---

### 3.2 스케줄 입력 및 유효성 검사

#### 3.2.1 시간대 체크박스 클릭
- **위치**: `src/screens/MedicineScheduleEditScreen.tsx`
- **함수**: `handleTimeSlotToggle(day, time)`
- **처리 과정**:
  1. `ScheduleValidationHelper.canToggleTimeSlot()` - 선택 가능 여부 확인
  2. **내부 호출**: `DosageFrequencyValidator.canSelectTimeSlot()`
  3. **검사 항목**:
     - 해당 요일에 이미 선택된 시간대 개수 확인
     - 약물의 일일 최대 복용 횟수 확인
     - `선택된_시간대_개수 >= 최대_복용_횟수`면 선택 불가
  4. **선택 가능하면**:
     - `matrixSchedule[day][time].enabled = !matrixSchedule[day][time].enabled`
     - 상태 업데이트
  5. **선택 불가하면**:
     - `Alert.alert()` - 제한 메시지 표시

#### 3.2.2 복용량 입력
- **위치**: `src/screens/MedicineScheduleEditScreen.tsx`
- **입력 필드**: 시간대별 복용량 입력
- **상태 업데이트**:
  - `timeDoses.morningDose` - 아침 복용량
  - `timeDoses.afternoonDose` - 점심 복용량
  - `timeDoses.eveningDose` - 저녁 복용량

#### 3.2.3 연령 기반 검증
- **위치**: `src/screens/MedicineScheduleEditScreen.tsx`
- **함수**: `comprehensiveValidation()`
- **검사 항목**:
  1. **연령 검증**:
     - `userAge < 2` → 에러: "2세 미만 영아는 약물 복용이 금지됩니다."
     - `userAge < 7` → 경고: "7세 미만은 전문의 상담이 필요합니다."
     - `8 <= userAge <= 14` → 경고: "소아용 용량으로 조정이 필요합니다 (성인 용량의 50%)."
  2. **처방 정보 검증**:
     - `prescriptionInfo.isValid` 확인
     - 복용 횟수, 복용량 일치 여부 확인
  3. **스케줄 검증**:
     - 일일 최대 복용 횟수 초과 여부 확인

---

### 3.3 스케줄 저장

#### 3.3.1 저장 버튼 클릭
- **위치**: `src/screens/MedicineScheduleEditScreen.tsx`
- **함수**: `handleSave()`
- **처리 과정**:
  1. `ScheduleValidationHelper.validateBeforeSave()` - 최종 검증
  2. 검증 실패 시 `Alert.alert()` - 확인 요청
  3. 검증 성공 또는 강제 저장 선택 시 저장 진행

#### 3.3.2 매트릭스 데이터 변환
- **위치**: `src/api/medicine.ts`
- **함수**: `saveMedicineScheduleV3()`
- **변환 로직**:
  ```typescript
  const scheduleItems = [];
  for (const day of DAYS) {
    for (const time of TIMES) {
      const cellData = matrixSchedule[day]?.[time];
      if (cellData?.enabled && cellData.dose > 0) {
        scheduleItems.push({
          day_of_week: day,
          time_of_day: time,
          dose_count: cellData.dose,
          enabled: true
        });
      }
    }
  }
  ```

#### 3.3.3 스케줄 저장 API 호출
- **위치**: `src/api/medicine.ts`
- **API 엔드포인트**: `POST /api/schedule/medicine/{medicineId}/{memberId}`
- **요청 데이터**:
  ```json
  {
    "schedule_items": [
      {
        "day_of_week": "mon",
        "time_of_day": "morning",
        "dose_count": 1,
        "enabled": true
      },
      ...
    ],
    "total_quantity": "100",
    "version": "v3",
    "matrix_enabled": true,
    "request_user_id": "요청자_ID"
  }
  ```
- **요청 헤더**:
  ```
  Authorization: Bearer {액세스_토큰}
  Content-Type: application/json
  ```

#### 3.3.4 서버 처리
- **위치**: `TDB_Server/src/schedule/schedule.service.ts`
- **처리 과정**:
  1. 연령 검증 (`AgeValidationService`)
  2. 복용 횟수 검증 (`DosageFrequencyValidator`)
  3. 기존 스케줄 삭제
  4. 새 스케줄 저장
  5. 슬롯 예약 업데이트

#### 3.3.5 응답 처리
- **위치**: `src/screens/MedicineScheduleEditScreen.tsx`
- **응답 데이터**:
  ```json
  {
    "success": true,
    "data": {
      "message": "스케줄이 저장되었습니다."
    }
  }
  ```
- **성공 처리**:
  1. `Toast.show()` - 성공 메시지 표시
  2. `navigation.goBack()` - 이전 화면으로 이동
  3. `navigation.setParams({ refreshSchedule: true, medicineId: medicineId })` - 새로고침 플래그 설정

---

## 4. 복용 완료 처리

### 4.1 복용 완료 버튼 클릭

#### 4.1.1 버튼 클릭 이벤트
- **위치**: `src/screens/MainHomeScreen.tsx` 또는 대시보드
- **함수**: `handleCompleteDose(medicine, timeOfDay)`
- **파라미터**:
  - `medicine: Medicine` - 약물 정보
  - `timeOfDay: 'morning' | 'afternoon' | 'evening'` - 시간대

#### 4.1.2 권한 확인
- **위치**: `src/hooks/useDoseCompletion.ts`
- **함수**: `handleCompleteDose()`
- **검사 항목**:
  1. `selectedMember` 존재 여부 확인
  2. `completingDose[completionKey]` - 중복 호출 방지
  3. `isTargetUser` - 복용 대상 확인

#### 4.1.3 target_users 기반 사용자 결정
- **위치**: `src/hooks/useDoseCompletion.ts`
- **로직**:
  ```typescript
  let actualTargetUserId = selectedMember.user_id;
  if (medicine.target_users && medicine.target_users.length > 0) {
    actualTargetUserId = medicine.target_users[0];
  }
  ```

#### 4.1.4 오늘 스케줄 확인
- **위치**: `src/hooks/useDoseCompletion.ts`
- **함수**: `getTodayScheduleForMedicine()`
- **확인 항목**:
  1. 오늘 날짜의 스케줄 존재 여부
  2. 해당 시간대의 복용량 확인
  3. `todaySchedule[timeOfDay] > 0` - 복용 예정량 확인

#### 4.1.5 복용량 계산
- **위치**: `src/hooks/useDoseCompletion.ts`
- **계산 로직**:
  ```typescript
  const actualDose = todaySchedule[timeOfDay] || 1;
  ```

---

### 4.2 약물 배출 (디스펜서 연동)

#### 4.2.1 디스펜서 정보 조회
- **위치**: `src/hooks/useDoseCompletion.ts`
- **함수**: `handleCompleteDoseWithTarget()`
- **API 호출**: `userApi.getDispenserInfo(targetUserId)`
- **API 엔드포인트**: `GET /api/users/{userId}/dispenser`
- **응답 데이터**:
  ```json
  {
    "success": true,
    "data": {
      "machines": [
        {
          "machine_id": "machine_123",
          "max_slot": 3,
          "group_id": "그룹_ID"
        }
      ],
      "group_id": "그룹_ID"
    }
  }
  ```

#### 4.2.2 약물 배출 API 호출
- **위치**: `src/hooks/useDoseCompletion.ts`
- **함수**: `scheduleDispense()`
- **내부 호출**: `src/api/dispenser.ts` → `scheduleDispense()`
- **API 엔드포인트**: `POST /api/dispenser/dispense`
- **요청 데이터**:
  ```json
  {
    "machine_id": "machine_123",
    "user_id": "사용자_ID",
    "medi_id": "medicine_123",
    "slot": 1,
    "dose": 1,
    "notes": "morning 복용"
  }
  ```
- **응답 데이터**:
  ```json
  {
    "success": true,
    "data": {
      "message": "약물이 배출되었습니다.",
      "dispense_id": "dispense_123"
    }
  }
  ```

---

### 4.3 복용 기록 저장

#### 4.3.1 복용 완료 API 호출
- **위치**: `src/hooks/useDoseCompletion.ts`
- **함수**: `scheduleApi.completeDose()`
- **내부 호출**: `src/api/schedule.ts` → `completeDose()`
- **API 엔드포인트**: `POST /api/dose-history/complete`
- **요청 데이터**:
  ```json
  {
    "group_id": "그룹_ID",
    "user_id": "사용자_ID",
    "medi_id": "medicine_123",
    "time_of_day": "morning",
    "actual_dose": 1,
    "notes": "아침 복용"
  }
  ```

#### 4.3.2 서버 처리
- **위치**: `TDB_Server/src/dose-history/dose-history.service.ts`
- **함수**: `completeDose()`
- **처리 과정**:
  1. `getUserGroup(user_id)` - 사용자 그룹 정보 조회
  2. 기존 기록 확인:
     ```sql
     SELECT * FROM dose_history
     WHERE user_id = :user_id
       AND medi_id = :medi_id
       AND time_of_day = :time_of_day
       AND DATE(dose_date) = :today
     ```
  3. 기존 기록이 있으면:
     - 아두이노 배출 기록이면 업데이트하지 않음
     - 앱에서 생성한 기록이면 업데이트
  4. 기존 기록이 없으면:
     - 새 기록 생성
     - `doseHistoryRepository.save()`

#### 4.3.3 응답 데이터
- **응답 형식**:
  ```json
  {
    "success": true,
    "data": {
      "dose_history_id": "history_123",
      "user_id": "사용자_ID",
      "medi_id": "medicine_123",
      "time_of_day": "morning",
      "actual_dose": 1,
      "dose_date": "2024-01-15T08:00:00Z"
    }
  }
  ```

---

### 4.4 UI 상태 업데이트

#### 4.4.1 복용 완료 상태 즉시 업데이트
- **위치**: `src/hooks/useDoseCompletion.ts`
- **상태 업데이트**:
  ```typescript
  const statusKey = `${medicine.medi_id}_${targetUserId}`;
  setDoseCompletionStatus(prev => ({
    ...prev,
    [statusKey]: {
      morning: prev[statusKey]?.morning || false,
      afternoon: prev[statusKey]?.afternoon || false,
      evening: prev[statusKey]?.evening || false,
      [timeOfDay]: true  // 해당 시간대 완료 표시
    }
  }));
  ```

#### 4.4.2 스케줄 데이터 새로고침
- **위치**: `src/hooks/useDoseCompletion.ts`
- **함수 호출**:
  1. `loadDailySchedule(medicine.medi_id, targetUserId)` - 오늘 스케줄 재조회
  2. `loadDoseCompletionStatus(medicine.medi_id, targetUserId)` - 복용 상태 재조회
  3. `setDoseCompletionStatus()` - 상태 업데이트

#### 4.4.3 성공 메시지 표시
- **위치**: `src/hooks/useDoseCompletion.ts`
- **함수**: `Toast.show()`
- **메시지**:
  ```typescript
  {
    type: 'success',
    text1: '아침 복용 완료',
    text2: '약물명 1정이 스케줄에 따라 배출되었습니다.',
    position: 'bottom'
  }
  ```

---

## 5. 약물 상호작용 검사

### 5.1 상호작용 검사 트리거

#### 5.1.1 검사 시점
- **위치**: `src/screens/MainHomeScreen.tsx`
- **트리거 조건**:
  1. 약물 목록 로드 완료 시
  2. 약물 추가/삭제 시
  3. 가족 구성원 변경 시

#### 5.1.2 검사 함수 호출
- **위치**: `src/screens/MainHomeScreen.tsx`
- **함수**: `checkFamilyDrugInteractions(forceRefresh?: boolean)`
- **내부 호출**: `src/hooks/useDrugInteractions.ts` → `checkFamilyDrugInteractions()`

---

### 5.2 빠른 상호작용 검사

#### 5.2.1 알려진 상호작용 체크
- **위치**: `src/utils/drugInteractionValidator.ts`
- **함수**: `quickCheckKnownInteractions()`
- **검사 로직**:
  1. 모든 약물 쌍 조합 생성 (`for i, for j`)
  2. `normalizeDrugName()` - 약물명 정규화
  3. `checkKnownInteractions()` - 알려진 상호작용 DB 확인
  4. **알려진 상호작용 예시**:
     - `['와파린', '아스피린']` → critical
     - `['이부프로펜', 'ACE억제제']` → major
     - `['칼슘', '철분']` → moderate

#### 5.2.2 결과 반환
- **반환 데이터**:
  ```typescript
  {
    hasInteractions: true,
    interactions: [
      {
        drugA: "와파린",
        drugB: "아스피린",
        severity: "critical",
        category: "blood_thinner",
        description: "출혈 위험이 현저히 증가할 수 있습니다.",
        recommendation: "반드시 의사와 상담 후 복용하세요.",
        sourceField: "known_interactions",
        confidence: 0.9
      }
    ],
    warningCount: 1,
    criticalCount: 1,
    overallRisk: "critical"
  }
  ```

---

### 5.3 상세 상호작용 검사

#### 5.3.1 약물 정보 조회
- **위치**: `src/utils/drugInteractionValidator.ts`
- **함수**: `checkDrugPairInteraction()`
- **처리 과정**:
  1. `getMedicineDataByName(drugA.name)` - 의약품 정보 조회
  2. `getMedicineDataByName(drugB.name)` - 의약품 정보 조회
  3. **API 엔드포인트**: `GET /api/medicine-master/search?query={약물명}&limit=1`
  4. **응답 데이터**:
     ```json
     {
       "success": true,
       "data": [
         {
           "name": "약물명",
           "precautions": "주의사항 텍스트",
           "primary_function": "효능효과 텍스트",
           "standard_spec": "기준규격 텍스트"
         }
       ]
     }
     ```

#### 5.3.2 텍스트 기반 상호작용 분석
- **위치**: `src/utils/drugInteractionValidator.ts`
- **함수**: `analyzeInteractionContent()`
- **분석 로직**:
  1. **카테고리 키워드 매칭**:
     - `blood_thinner`: ['와파린', '헤파린', '아스피린', '항응고', '혈전', '출혈']
     - `blood_pressure`: ['ACE억제제', 'ARB', '베타차단제', '혈압']
     - `diabetes`: ['인슐린', '메트포민', '혈당', '당뇨']
     - `pain_killer`: ['이부프로펜', '아세트아미노펜', 'NSAIDs', '진통제']
  2. **경고 키워드 확인**:
     - `blood_thinner`: ['출혈위험', '혈액응고', 'INR']
     - `blood_pressure`: ['저혈압', '고혈압', '심박수']
  3. **상호작용 발견 시**:
     - 같은 카테고리에 속하고 경고 키워드가 있으면 상호작용으로 판단
     - 위험도 결정: `determineSeverity(category, hasWarnings)`

#### 5.3.3 원료 성분 기반 검사 (영양제)
- **위치**: `src/utils/drugInteractionValidator.ts`
- **함수**: `checkIngredientInteraction()`
- **검사 로직**:
  1. `RAWMTRL_NM` 또는 `raw_materials` 필드 추출
  2. `findCommonIngredients()` - 공통 성분 찾기
  3. **공통 성분 예시**:
     - ['비타민A', '비타민B', '비타민C', '비타민D', '비타민E', '비타민K']
     - ['칼슘', '철분', '아연', '마그네슘', '셀레늄']
  4. 공통 성분이 있으면:
     - `severity: 'moderate'`
     - `description: "공통 성분으로 인한 과다 섭취 위험이 있습니다."`

---

### 5.4 상호작용 결과 표시

#### 5.4.1 경고 배너 표시
- **위치**: `src/screens/MainHomeScreen.tsx`
- **조건**: `showInteractionAlert && interactionResult`
- **컴포넌트**: `DrugInteractionAlert`
- **표시 정보**:
  1. 전체 위험도 (`overallRisk`)
  2. 상호작용 개수 (`interactions.length`)
  3. 심각한 상호작용 개수 (`criticalCount`)

#### 5.4.2 약물별 warning 상태 업데이트
- **위치**: `src/screens/MainHomeScreen.tsx`
- **함수**: `updateMedicineWarnings()`
- **처리 과정**:
  1. 상호작용이 있는 약물명 수집
  2. 약물명을 `medi_id`로 매핑
  3. 각 약물의 `warning` 필드 업데이트:
     - 상호작용 있음: `warning = 1`
     - 상호작용 없음: `warning = 0`
  4. **API 호출**: `PUT /api/medicine/{medi_id}`
  5. **요청 데이터**:
     ```json
     {
       "warning": 1
     }
     ```

#### 5.4.3 상세 정보 표시
- **위치**: `src/components/common/DrugInteractionAlert.tsx`
- **표시 내용**:
  1. 각 상호작용의 약물 쌍
  2. 위험도 (`severity`)
  3. 설명 (`description`)
  4. 권장사항 (`recommendation`)

---

## 6. 데이터 조회

### 6.1 가족 구성원 목록 조회

#### 6.1.1 조회 트리거
- **위치**: `src/screens/MainHomeScreen.tsx`
- **트리거 조건**:
  1. 앱 시작 시
  2. 로그인 완료 시
  3. 화면 포커스 시

#### 6.1.2 API 호출
- **위치**: `src/api/family.ts`
- **함수**: `getFamilyMembers()`
- **처리 과정**:
  1. `getCurrentUser()` - 현재 사용자 정보 조회
  2. `getToken()` - 액세스 토큰 조회
  3. **API 엔드포인트**: `GET /api/family/members?group_id={group_id}`
  4. **요청 헤더**:
     ```
     Authorization: Bearer {액세스_토큰}
     Content-Type: application/json
     ```

#### 6.1.3 응답 처리
- **응답 데이터**:
  ```json
  {
    "success": true,
    "data": [
      {
        "user_id": "user_123",
        "name": "사용자명",
        "age": 34,
        "role": "parent",
        "group_id": "그룹_ID",
        "birthDate": "1990-01-01"
      },
      ...
    ]
  }
  ```
- **상태 업데이트**: `setFamilyMembers(response.data.data)`

#### 6.1.4 선택된 멤버 복원
- **위치**: `src/screens/MainHomeScreen.tsx`
- **처리 과정**:
  1. `AsyncStorage.getItem('@selected_member_id')` - 저장된 멤버 ID 조회
  2. `familyMembers.find(m => m.user_id === savedId)` - 멤버 찾기
  3. `setSelectedMember(savedMember)` - 선택된 멤버 설정
  4. 저장된 멤버가 없으면:
     - 자녀 계정: 본인 계정 선택
     - 부모 계정: 부모 계정 선택

---

### 6.2 약물 목록 조회

#### 6.2.1 조회 트리거
- **위치**: `src/screens/MainHomeScreen.tsx`
- **트리거 조건**:
  1. 선택된 멤버 변경 시
  2. 화면 포커스 시
  3. 새로고침 시

#### 6.2.2 캐시 확인
- **위치**: `src/screens/MainHomeScreen.tsx`
- **함수**: `loadMedicineList()`
- **처리 과정**:
  1. `CacheManager.get(CACHE_KEYS.MEDICINE_LIST(userId))` - 캐시 조회
  2. 캐시가 있으면:
     - `setMedicineList(cachedMedicines)` - 즉시 표시
     - `setLoading(false)` - 로딩 완료
  3. 캐시가 없으면:
     - `setLoading(true)` - 로딩 시작

#### 6.2.3 API 호출
- **위치**: `src/api/family.ts`
- **함수**: `getMedicineList(userId)`
- **API 엔드포인트**: `GET /api/medicine/list?connect={userId}`
- **요청 헤더**:
  ```
  Authorization: Bearer {액세스_토큰}
  Content-Type: application/json
  ```

#### 6.2.4 응답 처리
- **응답 데이터**:
  ```json
  {
    "success": true,
    "data": [
      {
        "medi_id": "medicine_123",
        "name": "약물명",
        "group_id": "그룹_ID",
        "start_date": "2024-01-01",
        "end_date": "2024-12-31",
        "slot": 1,
        "totalQuantity": "100",
        "remain": "50",
        "target_users": ["user_id1", "user_id2"],
        "warning": 0,
        "permission": "own" | "manage" | "others" | "common"
      },
      ...
    ]
  }
  ```
- **상태 업데이트**:
  1. `setMedicineList(response.data.data)`
  2. `CacheManager.set(cacheKey, response.data, CACHE_DURATION.MEDIUM)` - 캐시 저장

#### 6.2.5 권한 필터링
- **위치**: `src/screens/MainHomeScreen.tsx`
- **필터링 로직**:
  ```typescript
  const accessibleMedicines = medicineList.filter(medicine => {
    const permission = medicine.permission;
    if (userType === 'parent') {
      return true; // 보호자는 모든 약물 접근 가능
    } else {
      return permission === 'own' || permission === 'common'; // 자녀는 본인 약물과 공통 약물만
    }
  });
  ```

---

### 6.3 오늘 스케줄 조회

#### 6.3.1 조회 트리거
- **위치**: `src/screens/MainHomeScreen.tsx`
- **트리거 조건**:
  1. 약물 목록 로드 완료 시
  2. 선택된 멤버 변경 시
  3. 화면 포커스 시

#### 6.3.2 스케줄 조회
- **위치**: `src/hooks/useScheduleData.ts`
- **함수**: `loadDailySchedule(medicineId, userId)`
- **내부 호출**: `src/api/medicine.ts` → `getDailySchedule()`
- **API 엔드포인트**: `GET /api/schedule/daily/{medicineId}/{userId}?date={오늘날짜}`
- **응답 데이터**:
  ```json
  {
    "success": true,
    "data": {
      "morning": 1,
      "afternoon": 0,
      "evening": 1,
      "total": 2,
      "isScheduledDay": true
    }
  }
  ```

#### 6.3.3 스케줄 캐싱
- **위치**: `src/hooks/useScheduleData.ts`
- **캐시 키**: `${medicineId}_${userId}`
- **캐시 저장**: `dailySchedules[scheduleKey] = response.data.data`

#### 6.3.4 복용 완료 상태 조회
- **위치**: `src/screens/MainHomeScreen.tsx`
- **함수**: `loadDoseCompletionStatus(medicineId, userId)`
- **API 엔드포인트**: `GET /api/dose-history/today-status?user_id={userId}&medi_id={medicineId}&date={오늘날짜}`
- **응답 데이터**:
  ```json
  {
    "success": true,
    "data": {
      "medi_id": "medicine_123",
      "user_id": "user_123",
      "morning": true,
      "afternoon": false,
      "evening": true,
      "date": "2024-01-15"
    }
  }
  ```
- **상태 저장**: `doseCompletionStatus[statusKey] = response.data.data`

#### 6.3.5 일괄 조회 (최적화)
- **위치**: `src/screens/MainHomeScreen.tsx`
- **함수**: `loadAllDoseCompletionStatus(userId, medicineIds)`
- **API 엔드포인트**: `GET /api/dose-history/today-status?user_id={userId}&date={오늘날짜}`
- **응답 데이터**:
  ```json
  {
    "success": true,
    "data": [
      {
        "medi_id": "medicine_123",
        "morning": true,
        "afternoon": false,
        "evening": true
      },
      ...
    ]
  }
  ```
- **처리**: 모든 약물의 복용 상태를 한 번에 조회하여 성능 최적화

---

## 7. 사용자 선택 및 멤버 관리

### 7.1 멤버 선택 프로세스

#### 7.1.1 멤버 선택 버튼 클릭
- **위치**: `src/components/member/MemberSelector.tsx`
- **이벤트**: `onSelectMember(member)`

#### 7.1.2 권한 확인
- **위치**: `src/screens/MainHomeScreen.tsx`
- **함수**: `handleSelectMember(member)`
- **검사 항목**:
  1. `user.role === 'child' && member.role === 'parent'` - 자녀 계정이 부모 계정 선택 시도
  2. 권한 없으면 `Toast.show()` 에러 메시지 후 종료

#### 7.1.3 멤버 선택 처리
- **처리 과정**:
  1. `setSelectedMember(member)` - 선택된 멤버 상태 업데이트
  2. `setIsExpanded(false)` - 멤버 선택 리스트 닫기
  3. `AsyncStorage.setItem('@selected_member_id', member.user_id)` - 선택된 멤버 ID 저장

#### 7.1.4 약물 목록 자동 조회
- **위치**: `src/screens/MainHomeScreen.tsx`
- **트리거**: `selectedMember` 변경 시 `useEffect` 실행
- **함수 호출**: `loadMedicineList()`

---

### 7.2 멤버 정보 표시

#### 7.2.1 멤버 카드 렌더링
- **위치**: `src/components/member/MemberCard.tsx`
- **표시 정보**:
  1. `member.name` - 이름
  2. `member.age` - 나이
  3. `member.role === 'parent' ? '보호자 계정' : '자녀 계정'` - 계정 타입

#### 7.2.2 선택 상태 표시
- **조건**: `selectedMember?.user_id === member.user_id`
- **스타일**: 선택된 멤버는 다른 배경색/테두리로 표시

---

## 부록: 주요 상수 및 설정

### API 엔드포인트
- **위치**: `src/constants/api.ts`
- **주요 엔드포인트**:
  - `AUTH.LOGIN`: `/api/auth/login`
  - `AUTH.SIGNUP`: `/api/auth/signup`
  - `AUTH.REFRESH_TOKEN`: `/api/auth/refresh-token`
  - `MEDICINE.ADD`: `/api/medicine`
  - `MEDICINE.LIST`: `/api/medicine/list`
  - `MEDICINE.DELETE`: `/api/medicine/{connect}/{medi_id}`
  - `SCHEDULE.SAVE`: `/api/schedule/medicine/{medicineId}/{memberId}`
  - `SCHEDULE.DAILY_SCHEDULE`: `/api/schedule/daily/{medicineId}/{userId}`
  - `DOSE_HISTORY.COMPLETE`: `/api/dose-history/complete`
  - `DOSE_HISTORY.TODAY_STATUS`: `/api/dose-history/today-status`

### 캐시 설정
- **위치**: `src/utils/cache.ts`
- **캐시 키**:
  - `FAMILY_MEMBERS(group_id)`: `family_members_${group_id}`
  - `MEDICINE_LIST(userId)`: `medicine_list_${userId}`
- **캐시 지속 시간**:
  - `SHORT`: 1분
  - `MEDIUM`: 5분
  - `LONG`: 30분

### 디스펜서 설정
- **위치**: `src/constants/dispenser.ts`
- **설정값**:
  - `MAX_SLOTS`: 3 (최대 슬롯 개수)

---

## 결론

이 문서는 TDB 프로젝트의 주요 기능별 함수 호출 흐름을 상세히 정리한 것입니다. 각 기능은 다음과 같은 흐름을 따릅니다:

1. **사용자 입력** → **유효성 검사** → **API 호출** → **서버 처리** → **응답 처리** → **상태 업데이트** → **UI 반영**

모든 함수 호출은 에러 처리와 로딩 상태 관리가 포함되어 있으며, 사용자 경험을 최적화하기 위한 캐싱 및 점진적 로딩 전략이 적용되어 있습니다.

