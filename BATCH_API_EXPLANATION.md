# 🔄 배치 API의 역할과 필요성

## 📊 현재 방식 vs 배치 API

### 현재 방식 (개별 API 호출)

**대시보드를 로드할 때:**

```typescript
// useFamilyDashboard.ts에서
const detailedSchedulePromises = members.map(async (member) => {
  // 각 구성원마다 개별 API 호출
  const [memberTodayResponse, medicineListResponse] = await Promise.all([
    getMemberTodayStats(member.user_id),      // API 호출 1
    getMedicineList(member.user_id)           // API 호출 2
  ]);
  
  // 영양제가 있으면 추가 호출
  supplements.forEach(async (supplement) => {
    await getSupplementSchedule(...);         // API 호출 3, 4, 5...
  });
});
```

**구성원 3명, 각 약물 5개, 영양제 3개인 경우:**

```
📱 앱 (클라이언트)                    🖥️ 서버
   │                                    │
   ├─ getMemberTodayStats(user1) ──────>│
   │<───────────────────────────────────┤ (200ms)
   ├─ getMedicineList(user1) ─────────>│
   │<───────────────────────────────────┤ (200ms)
   ├─ getSupplementSchedule(supp1) ────>│
   │<───────────────────────────────────┤ (200ms)
   ├─ getSupplementSchedule(supp2) ────>│
   │<───────────────────────────────────┤ (200ms)
   ├─ getMemberTodayStats(user2) ──────>│
   │<───────────────────────────────────┤ (200ms)
   ├─ getMedicineList(user2) ─────────>│
   │<───────────────────────────────────┤ (200ms)
   ... (총 15번의 API 호출)
   
   총 소요 시간: 약 1.7초 (네트워크 왕복 시간 누적)
```

### 배치 API 방식 (한 번에 조회)

**대시보드를 로드할 때:**

```typescript
// 배치 API 사용
const response = await apiClient.get(
  `/api/dose-history/family-today-schedules/${connect}`
);
// 한 번의 API 호출로 모든 구성원의 데이터를 받음
```

**구성원 3명, 각 약물 5개, 영양제 3개인 경우:**

```
📱 앱 (클라이언트)                    🖥️ 서버
   │                                    │
   ├─ getFamilyTodaySchedules(connect)─>│
   │                                    │ (서버에서 모든 데이터 조회)
   │                                    │ - user1, user2, user3의 스케줄
   │                                    │ - 모든 약물 목록
   │                                    │ - 모든 영양제 스케줄
   │<───────────────────────────────────┤ (300ms, 한 번에 처리)
   
   총 소요 시간: 약 0.5초 (1번의 API 호출)
```

---

## 🎯 배치 API의 핵심 역할

### 1. **네트워크 왕복 시간 감소**

**현재:**
- 각 API 호출마다 네트워크 왕복 시간 발생
- 15번 호출 = 15번의 왕복 시간
- 각 왕복에 약 100-200ms 소요

**배치 API:**
- 1번의 API 호출 = 1번의 왕복 시간
- 서버에서 모든 데이터를 한 번에 조회

### 2. **서버 부하 감소**

**현재:**
- 각 API 호출마다 서버에서 DB 쿼리 실행
- 15번의 개별 쿼리 실행
- 서버 리소스 낭비

**배치 API:**
- 서버에서 한 번의 최적화된 쿼리로 모든 데이터 조회
- JOIN을 활용한 효율적인 쿼리
- 서버 리소스 절약

### 3. **데이터 일관성 보장**

**현재:**
- 각 API 호출 사이에 시간 차이 발생
- 첫 번째 구성원 데이터와 마지막 구성원 데이터 사이에 시간 차이
- 데이터 불일치 가능성

**배치 API:**
- 모든 데이터를 동일한 시점에 조회
- 트랜잭션으로 일관성 보장 가능

---

## 📝 실제 코드 비교

### 현재 방식 (useFamilyDashboard.ts)

```typescript
// 각 구성원마다 개별 호출
const detailedSchedulePromises = members.map(async (member) => {
  // 1. 약물 스케줄 조회
  const memberTodayResponse = await getMemberTodayStats(member.user_id);
  
  // 2. 약물 목록 조회
  const medicineListResponse = await getMedicineList(member.user_id);
  
  // 3. 영양제 스케줄 조회 (영양제 개수만큼)
  const supplementSchedules = await Promise.all(
    supplements.map(s => getSupplementSchedule(s.medi_id, member.user_id))
  );
  
  return { memberName: member.name, schedule: ... };
});

// 모든 구성원의 데이터를 기다림
const results = await Promise.all(detailedSchedulePromises);
```

**문제점:**
- 구성원 3명 × (약물 스케줄 1 + 약물 목록 1 + 영양제 3) = **15번의 API 호출**
- 네트워크 왕복 시간 누적
- 서버 부하 증가

### 배치 API 방식 (제안)

```typescript
// 한 번의 API 호출로 모든 데이터 조회
const response = await apiClient.get(
  `/api/dose-history/family-today-schedules/${connect}`
);

// 응답 예시:
{
  "success": true,
  "data": {
    "members": [
      {
        "user_id": "user1",
        "name": "사용자1",
        "medicines": [
          {
            "medi_id": "medi1",
            "name": "약물1",
            "schedules": [
              {
                "time_of_day": "morning",
                "status": "completed",
                "scheduled_dose": 1,
                "actual_dose": 1
              }
            ]
          }
        ],
        "supplements": [
          {
            "medi_id": "supplement_1",
            "name": "영양제1",
            "schedules": [...]
          }
        ]
      },
      {
        "user_id": "user2",
        "name": "사용자2",
        "medicines": [...],
        "supplements": [...]
      }
    ]
  }
}
```

**장점:**
- **1번의 API 호출**로 모든 데이터 조회
- 네트워크 왕복 시간 최소화
- 서버 부하 감소
- 데이터 일관성 보장

---

## 🔍 백엔드 구현 예시

### 배치 API 엔드포인트

```typescript
// TDB_Server/src/dose-history/dose-history.controller.ts

@Get('family-today-schedules/:group_id')
async getFamilyTodaySchedules(@Param('group_id') group_id: string) {
  return this.doseHistoryService.getFamilyTodaySchedules(group_id);
}
```

### 서비스 메서드

```typescript
// TDB_Server/src/dose-history/dose-history.service.ts

async getFamilyTodaySchedules(group_id: string) {
  const today = new Date().toISOString().split('T')[0];
  const dayOfWeek = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][new Date().getDay()];
  
  // 1. 가족 구성원 조회 (1번의 쿼리)
  const members = await this.membershipRepository
    .createQueryBuilder('m')
    .innerJoin('m.user', 'user')
    .where('m.group_id = :group_id', { group_id })
    .select(['user.user_id', 'user.name', 'm.role'])
    .getRawMany();
  
  // 2. 모든 구성원의 오늘 스케줄 조회 (1번의 쿼리, JOIN 활용)
  const schedules = await this.scheduleRepository
    .createQueryBuilder('s')
    .innerJoin('s.medicine', 'medicine')
    .where('s.group_id = :group_id', { group_id })
    .andWhere('s.day_of_week = :dayOfWeek', { dayOfWeek })
    .select([
      's.user_id',
      's.medi_id',
      'medicine.name as medi_name',
      's.time_of_day',
      's.dose as scheduled_dose',
      's.created_at'
    ])
    .getRawMany();
  
  // 3. 모든 구성원의 오늘 복용 기록 조회 (1번의 쿼리)
  const histories = await this.doseHistoryRepository
    .createQueryBuilder('dh')
    .where('dh.group_id = :group_id', { group_id })
    .andWhere('dh.dose_date = :today', { today })
    .getMany();
  
  // 4. 모든 구성원의 약물 목록 조회 (1번의 쿼리)
  const medicines = await this.medicineRepository
    .createQueryBuilder('m')
    .where('m.group_id = :group_id', { group_id })
    .getMany();
  
  // 5. 모든 구성원의 영양제 스케줄 조회 (1번의 쿼리)
  const supplementSchedules = await this.supplementScheduleRepository
    .createQueryBuilder('ss')
    .where('ss.group_id = :group_id', { group_id })
    .getMany();
  
  // 6. 데이터 가공 (메모리에서 처리)
  const result = members.map(member => {
    const memberSchedules = schedules.filter(s => s.user_id === member.user_id);
    const memberHistories = histories.filter(h => h.user_id === member.user_id);
    const memberMedicines = medicines.filter(m => m.user_id === member.user_id);
    const memberSupplements = supplementSchedules.filter(s => s.user_id === member.user_id);
    
    return {
      user_id: member.user_id,
      name: member.name,
      medicines: memberMedicines.map(med => ({
        medi_id: med.medi_id,
        name: med.name,
        schedules: memberSchedules
          .filter(s => s.medi_id === med.medi_id)
          .map(s => ({
            time_of_day: s.time_of_day,
            status: this.calculateStatus(s, memberHistories),
            scheduled_dose: s.scheduled_dose,
            actual_dose: this.getActualDose(s, memberHistories),
            completed_at: this.getCompletedAt(s, memberHistories)
          }))
      })),
      supplements: memberSupplements.map(supp => ({
        medi_id: supp.medi_id,
        name: supp.name,
        schedules: [...]
      }))
    };
  });
  
  return { success: true, data: { members: result } };
}
```

**핵심 차이:**
- 현재: 15번의 개별 쿼리
- 배치 API: 5번의 최적화된 쿼리 (JOIN 활용)
- 데이터 가공은 메모리에서 처리 (빠름)

---

## 📈 성능 비교

| 항목 | 현재 방식 | 배치 API | 개선율 |
|------|---------|---------|--------|
| API 호출 횟수 | 15번 | 1번 | **93% 감소** |
| 네트워크 왕복 | 15번 | 1번 | **93% 감소** |
| 서버 쿼리 | 15번 | 5번 | **67% 감소** |
| 로딩 시간 | 1.7초 | 0.5초 | **70% 개선** |
| 서버 부하 | 높음 | 낮음 | **67% 감소** |

---

## 🎯 결론

**배치 API의 역할:**
1. **여러 개의 개별 API 호출을 하나로 통합**
2. **네트워크 왕복 시간 최소화**
3. **서버 부하 감소**
4. **데이터 일관성 보장**
5. **사용자 경험 개선 (로딩 시간 단축)**

**간단히 말하면:**
- 현재: 각 구성원마다 따로따로 물어보기 (15번)
- 배치 API: 한 번에 모든 구성원 정보 받기 (1번)

**비유:**
- 현재: 편의점에서 우유, 빵, 계란을 각각 따로 사기 (3번 방문)
- 배치 API: 마트에서 한 번에 모든 것 사기 (1번 방문)

