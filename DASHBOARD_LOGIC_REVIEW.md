# 대시보드 로직 전체 점검 결과

## ✅ 수정 완료 사항

### 1. **getFamilyTodaySchedules - notes 필드 누락 수정**
- **문제**: `scheduleData`에 `notes` 필드가 포함되지 않아 클라이언트에서 배출 기록을 확인할 수 없음
- **수정**: `history?.notes || undefined` 추가하여 배출 기록 전달
- **위치**: `TDB_Server/src/dose-history/dose-history.service.ts:875`

### 2. **영양제 처리 - 놓침 상태 처리 누락 수정**
- **문제**: 영양제 처리 부분에서 놓침 상태에 대한 새로운 스케줄 체크가 없음
- **수정**: 약물 처리와 동일하게 놓침 상태 유지 및 새로운 스케줄 체크 로직 추가
- **위치**: `src/hooks/useFamilyDashboard.ts:440-474`

## ✅ 정상 동작 확인 사항

### 1. **체크리스트 기록과 배출 기록 분리**
- ✅ `completeDose`: 체크리스트 기록은 `notes`에 `[배출완료]` 미포함
- ✅ `getFamilyTodaySchedules`: `notes NOT LIKE '%[배출완료]%'` 필터로 체크리스트 기록만 조회
- ✅ `getDetailedFamilyStats`: 동일한 필터 적용

### 2. **24시간 기준 초기화**
- ✅ 완료 상태: `DATE(dh.dose_date) = :today` 조건으로 오늘 날짜만 조회
- ✅ 놓침 상태: 24시간 기준으로 초기화되지 않음 (사용자 요구사항에 따라 유지)
- ✅ 클라이언트: 날짜 변경 시 `setDoseCompletionStatus({})` 호출

### 3. **새로운 스케줄 등록 시 상태 초기화**
- ✅ 서버: `getFamilyTodaySchedules`에서 `schedule.created_at > history.completed_at` 체크
- ✅ 클라이언트: `useFamilyDashboard`에서 동일한 체크 수행
- ✅ 스케줄 재등록: `schedule.service.ts`에서 해당 시간대 기록 삭제

### 4. **놓침 카운트 계산**
- ✅ `getDetailedFamilyStats`: `todayHistories.filter(h => h.status === DoseStatus.MISSED).length`
- ✅ 시간대별 통계: `missedForTime` 계산 정상
- ✅ 멤버별 통계: `memberMissed` 계산 정상
- ✅ 디버깅 로그 추가로 확인 가능

### 5. **시간대별 통계 계산**
- ✅ `timeBasedStats`: 각 시간대별 `scheduled`, `completed`, `missed`, `remaining` 계산 정상
- ✅ `remaining = scheduled - completed - missed` 공식 정확
- ✅ `refreshData` 호출 시 즉시 반영

## 🔍 로직 흐름 확인

### 체크리스트에서 X 버튼 클릭 시:
1. `TimeSlotCard.handleMarkMedicineCompleted(medicine, false)` 호출
2. `actual_dose: 0`으로 `completeDose` API 호출
3. 서버 `completeDose`에서 `DoseStatus.MISSED` 저장 (notes에 `[배출완료]` 미포함)
4. `onStatusUpdate` 호출하여 대시보드 새로고침
5. `getFamilyTodaySchedules`에서 놓침 기록 조회
6. `getDetailedFamilyStats`에서 `totalMissed` 계산
7. 클라이언트에서 `dashboardStats.totalMissed` 표시

### 대시보드 통계 조회 시:
1. `getDetailedFamilyStats` 호출
2. `todayHistories` 조회 (체크리스트 기록만)
3. `totalScheduled`, `totalCompleted`, `totalMissed`, `totalRemaining` 계산
4. `timeBasedStats` 계산 (시간대별 통계)
5. `memberStats` 계산 (멤버별 통계)
6. 클라이언트에서 표시

## ⚠️ 주의 사항

### 1. **놓침 상태는 24시간 기준으로 초기화되지 않음**
- 사용자 요구사항에 따라 놓침 상태는 유지됨
- 새로운 스케줄 등록 시에만 초기화됨

### 2. **체크리스트 기록과 배출 기록 분리**
- 체크리스트 기록: `notes`에 `[배출완료]` 미포함 또는 `NULL`
- 배출 기록: `notes`에 `[배출완료]` 포함
- 대시보드 통계는 체크리스트 기록만 사용

### 3. **날짜 비교 정확도**
- `DATE(dh.dose_date) = :today` 사용으로 시간 무시하고 날짜만 비교
- 클라이언트에서도 `completedDate !== today` 체크 수행

## 📊 데이터 흐름 다이어그램

```
체크리스트 X 버튼 클릭
  ↓
completeDose API (actual_dose: 0)
  ↓
DoseHistory 저장 (status: MISSED, notes: "[날짜] 수동 체크 - 복용 안 함")
  ↓
onStatusUpdate 호출
  ↓
refreshData() → fetchData()
  ↓
getDetailedFamilyStats() 호출
  ↓
todayHistories 조회 (notes NOT LIKE '%[배출완료]%')
  ↓
totalMissed = todayHistories.filter(h => h.status === MISSED).length
  ↓
dashboardStats.totalMissed 업데이트
  ↓
StatsGrid 컴포넌트에 "놓침" 카운트 표시
```

## 🎯 최종 확인 사항

- ✅ 놓침 카운트가 상단 요약에 정확히 반영됨
- ✅ 시간대별 통계에 놓침이 포함됨
- ✅ 체크리스트 기록이 앱 재시작 후에도 유지됨
- ✅ 새로운 스케줄 등록 시 상태가 초기화됨
- ✅ 배출 기록과 체크리스트 기록이 분리됨

