# "나의 시간대별 복용현황" 데이터 흐름

## 📊 데이터 소스

"나의 시간대별 복용현황"은 다음 데이터를 사용합니다:

### 1. **데이터 소스: `todayDetailedSchedule`**

```typescript
// src/components/FamilyDashboard.tsx:84-153
const currentUserTimeStats = React.useMemo(() => {
  // 현재 사용자의 이름으로 todayDetailedSchedule에서 스케줄 찾기
  const currentUserName = familyMembers.find(m => m.user_id === user.user_id)?.name;
  const userSchedule = todayDetailedSchedule[currentUserName];
  
  // 각 시간대별로 통계 계산
  return (['morning', 'afternoon', 'evening'] as const).map(timeOfDay => {
    const medicines = userSchedule[timeOfDay] || [];
    const scheduled = medicines.length;
    const completed = medicines.filter(m => m.status === 'completed').length;
    const missed = medicines.filter(m => m.status === 'missed').length;
    const remaining = Math.max(0, scheduled - completed - missed);
    const completionRate = actualScheduled > 0 ? Math.round((completed / actualScheduled) * 100) : 0;
  });
}, [user?.user_id, familyMembers, todayDetailedSchedule]);
```

### 2. **`todayDetailedSchedule`의 생성 과정**

#### Step 1: 서버 API 호출
```typescript
// src/hooks/useFamilyDashboard.ts:362
const batchResponse = await getFamilyTodaySchedules(connect);
```

#### Step 2: 서버에서 반환하는 데이터
```typescript
// TDB_Server/src/dose-history/dose-history.service.ts:729-877
// getFamilyTodaySchedules 함수
{
  members: [
    {
      name: "차호준",
      medicines: [
        {
          medi_id: "...",
          name: "아네모정",
          time_of_day: "afternoon",
          scheduled_dose: 1,
          status: "completed" | "missed" | "partial" | null,  // 🔥 핵심!
          completed_at: "2024-01-01T12:00:00Z",
          schedule_created_at: "2024-01-01T08:00:00Z",
          notes: "..."
        }
      ]
    }
  ]
}
```

#### Step 3: 클라이언트에서 상태 변환
```typescript
// src/hooks/useFamilyDashboard.ts:408-441
const medicineStatusPromises = memberData.medicines.map((schedule: any) => {
  // getDoseStatus 함수로 상태 변환
  return getDoseStatus(
    schedule.status,              // 서버에서 받은 상태
    schedule.time_of_day,
    schedule.schedule_created_at,
    schedule.completed_at
  );
});

// getDoseStatus는 다음 중 하나를 반환:
// - 'completed' (서버 status가 'completed' 또는 'partial')
// - 'missed' (서버 status가 'missed')
// - 'pending' (서버 status가 null이거나 새로운 스케줄)
// - 'upcoming' (시간 범위 전)
```

#### Step 4: `todayDetailedSchedule` 구성
```typescript
// src/hooks/useFamilyDashboard.ts:431-439
timeSlotSchedule[timeOfDay].push({
  name: schedule.name,
  status: finalStatus,  // getDoseStatus에서 반환된 상태
  medi_id: schedule.medi_id,
  scheduled_dose: schedule.scheduled_dose,
  actual_dose: schedule.actual_dose,
  completed_at: schedule.completed_at,
  notes: schedule.notes
});

// 최종적으로:
todayDetailedSchedule = {
  "차호준": {
    morning: [{ name: "...", status: "completed", ... }],
    afternoon: [{ name: "아네모정", status: "completed", ... }],
    evening: [{ name: "...", status: "pending", ... }]
  }
}
```

## 🔄 상태 업데이트 흐름

### 체크리스트 버튼 클릭 시:

1. **TimeSlotCard에서 체크 버튼 클릭**
   ```typescript
   // src/components/dashboard/TimeSlotCard.tsx:103
   handleMarkMedicineCompleted(medicine, true)
   ```

2. **API 호출로 상태 저장**
   ```typescript
   // src/components/dashboard/TimeSlotCard.tsx:119-140
   await apiClient.post('/api/dose-history/complete', {
     medi_id: medicine.medi_id,
     user_id: userId,
     time_of_day: timeOfDay,
     actual_dose: completed ? scheduled_dose : 0,
     notes: `[${today}] 수동 체크 - ${completed ? '복용 완료' : '복용 안 함'}`
   });
   ```

3. **대시보드 새로고침**
   ```typescript
   // src/components/dashboard/TimeSlotCard.tsx:139
   onStatusUpdate(medicine.medi_id, userId, timeOfDay);
   
   // src/components/FamilyDashboard.tsx:76-81
   const handleStatusUpdate = async (...) => {
     await refreshData();  // 🔥 여기서 todayDetailedSchedule 재로드
   };
   ```

4. **`todayDetailedSchedule` 업데이트**
   ```typescript
   // src/hooks/useFamilyDashboard.ts:856-873
   const refreshData = async () => {
     await fetchData();  // getFamilyTodaySchedules 다시 호출
   };
   ```

5. **`currentUserTimeStats` 재계산**
   ```typescript
   // useMemo의 의존성 배열에 todayDetailedSchedule이 포함되어 있으므로
   // todayDetailedSchedule이 변경되면 자동으로 재계산됨
   }, [user?.user_id, familyMembers, todayDetailedSchedule]);
   ```

## ⚠️ 현재 문제점

### 문제 1: 상태가 즉시 반영되지 않음
- **원인**: `refreshData()`가 완료될 때까지 기다리지 않거나, 서버에서 최신 상태를 반환하지 않음
- **증상**: 체크를 눌러도 "0/2"로 표시됨

### 문제 2: 앱 재시작 시 상태가 초기화됨
- **원인**: 서버에서 `DATE(dh.dose_date) = :today`로 필터링하지만, 클라이언트에서 추가 날짜 체크를 하면서 상태를 `pending`으로 변경
- **증상**: 앱을 껐다 키면 "대기중"으로 표시됨

## 🔍 디버깅 포인트

### 1. 서버에서 반환하는 상태 확인
```typescript
// TDB_Server/src/dose-history/dose-history.service.ts:824-865
let finalStatus: 'completed' | 'missed' | 'partial' | null = null;

if (history) {
  if (historyStatus === 'completed' || history.status === DoseStatus.COMPLETED) {
    finalStatus = 'completed';
  } else if (historyStatus === 'missed' || history.status === DoseStatus.MISSED) {
    finalStatus = 'missed';
  }
}
```

### 2. 클라이언트에서 상태 변환 확인
```typescript
// src/hooks/useFamilyDashboard.ts:157-260
const getDoseStatus = async (
  backendStatus: 'completed' | 'missed' | 'partial' | null,
  ...
) => {
  if (backendStatus === 'completed') {
    return 'completed';  // 🔥 즉시 반환해야 함
  }
  if (backendStatus === 'missed') {
    return 'missed';
  }
  // ...
};
```

### 3. `todayDetailedSchedule` 업데이트 확인
```typescript
// 콘솔 로그로 확인:
console.log('🔍 [FamilyDashboard] 시간대별 통계 계산:', {
  morningMeds: userSchedule.morning?.map(m => ({ name: m.name, status: m.status })),
  afternoonMeds: userSchedule.afternoon?.map(m => ({ name: m.name, status: m.status })),
  eveningMeds: userSchedule.evening?.map(m => ({ name: m.name, status: m.status }))
});
```

## ✅ 해결 방법

1. **서버에서 상태를 정확히 반환하는지 확인**
   - `getFamilyTodaySchedules`에서 `finalStatus`가 제대로 설정되는지
   - `DATE(dh.dose_date) = :today` 필터가 제대로 작동하는지

2. **클라이언트에서 상태를 그대로 사용**
   - `getDoseStatus`에서 `backendStatus === 'completed'`이면 즉시 `'completed'` 반환
   - 추가 날짜 체크 제거 (서버에서 이미 처리)

3. **`refreshData` 완료 대기**
   - `handleStatusUpdate`에서 `await refreshData()` 완료 후 UI 업데이트

