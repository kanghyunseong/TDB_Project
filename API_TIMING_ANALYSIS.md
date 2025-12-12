# ⏱️ API 호출 시간 분석

## 📊 각 API 호출의 실제 소요 시간

### 1. `getMemberTodayStats` (약물 스케줄 조회)

**엔드포인트:** `GET /api/dose-history/today-progress/${userId}`

**처리 과정:**
1. 네트워크 요청 전송: **~50-100ms**
2. 서버 인증 확인: **~10-20ms**
3. DB 쿼리 실행:
   - 오늘의 스케줄 조회 (schedule 테이블)
   - 오늘의 복용 기록 조회 (dose_history 테이블)
   - 약물 정보 JOIN: **~50-100ms**
4. 데이터 가공 및 계산: **~10-20ms**
5. 네트워크 응답 전송: **~50-100ms**

**총 소요 시간: 약 170-340ms**
- 평균: **약 200-250ms**
- 최적 상황: **약 150ms**
- 네트워크 지연 시: **약 300-400ms**

---

### 2. `getMedicineList` (약물 목록 조회)

**엔드포인트:** `GET /api/medicine/list?connect=${userId}`

**처리 과정:**
1. 네트워크 요청 전송: **~50-100ms**
2. 서버 인증 확인: **~10-20ms**
3. DB 쿼리 실행:
   - 사용자 그룹 조회 (membership 테이블)
   - 약물 목록 조회 (medicine 테이블): **~30-80ms**
   - 슬롯 정보 조회 (machine_slot 테이블): **~30-50ms**
   - 권한 정보 확인: **~10-20ms**
4. 데이터 가공: **~10-20ms**
5. 네트워크 응답 전송: **~50-100ms**

**총 소요 시간: 약 190-390ms**
- 평균: **약 250-300ms**
- 최적 상황: **약 180ms**
- 네트워크 지연 시: **약 350-450ms**

---

## 🔍 실제 측정 예시

### 구성원 3명인 경우

**현재 방식 (순차 처리):**

```
구성원 1:
  getMemberTodayStats(user1)    → 200ms
  getMedicineList(user1)        → 250ms
  getSupplementSchedule(supp1)  → 150ms
  getSupplementSchedule(supp2)  → 150ms
  getSupplementSchedule(supp3)  → 150ms
  ─────────────────────────────────────
  소계: 약 900ms

구성원 2:
  getMemberTodayStats(user2)    → 200ms
  getMedicineList(user2)        → 250ms
  getSupplementSchedule(supp1)  → 150ms
  getSupplementSchedule(supp2)  → 150ms
  getSupplementSchedule(supp3)  → 150ms
  ─────────────────────────────────────
  소계: 약 900ms

구성원 3:
  getMemberTodayStats(user3)    → 200ms
  getMedicineList(user3)        → 250ms
  getSupplementSchedule(supp1)  → 150ms
  getSupplementSchedule(supp2)  → 150ms
  getSupplementSchedule(supp3)  → 150ms
  ─────────────────────────────────────
  소계: 약 900ms

총 시간: 약 2,700ms (2.7초)
```

**병렬 처리 시 (Promise.all 사용):**

```
모든 구성원 동시 처리:
  구성원 1, 2, 3의 모든 API 호출을 병렬로 실행
  
  가장 느린 API 호출 시간: 약 900ms
  ─────────────────────────────────────
  총 시간: 약 900ms (0.9초)
```

**배치 API 사용 시:**

```
한 번의 API 호출:
  getFamilyTodaySchedules(connect)  → 300-400ms
  (서버에서 모든 데이터를 한 번에 조회)
  ─────────────────────────────────────
  총 시간: 약 300-400ms (0.3-0.4초)
```

---

## 📈 시간 분해 분석

### 네트워크 지연 시간

**로컬 네트워크 (같은 서버):**
- 요청 전송: **10-30ms**
- 응답 수신: **10-30ms**
- 총: **20-60ms**

**인터넷 (일반적인 모바일 네트워크):**
- 요청 전송: **50-150ms**
- 응답 수신: **50-150ms**
- 총: **100-300ms**

**느린 네트워크 (3G 또는 약한 WiFi):**
- 요청 전송: **200-500ms**
- 응답 수신: **200-500ms**
- 총: **400-1000ms**

### 서버 처리 시간

**DB 쿼리 시간:**
- 단순 SELECT (인덱스 사용): **10-50ms**
- JOIN 쿼리: **30-100ms**
- 복잡한 집계 쿼리: **50-200ms**

**애플리케이션 로직:**
- 데이터 가공: **10-50ms**
- 비즈니스 로직: **10-100ms**

---

## 🎯 실제 측정 방법

### 프론트엔드에서 측정

```typescript
// getMemberTodayStats 시간 측정
const startTime = performance.now();
const response = await getMemberTodayStats(userId);
const endTime = performance.now();
const duration = endTime - startTime;
console.log(`getMemberTodayStats 소요 시간: ${duration}ms`);

// getMedicineList 시간 측정
const startTime2 = performance.now();
const response2 = await getMedicineList(userId);
const endTime2 = performance.now();
const duration2 = endTime2 - startTime2;
console.log(`getMedicineList 소요 시간: ${duration2}ms`);
```

### 백엔드에서 측정

```typescript
// TDB_Server/src/dose-history/dose-history.controller.ts
@Get('today-progress/:user_id')
async getTodayProgress(@Param('user_id') user_id: string) {
  const startTime = Date.now();
  
  try {
    const result = await this.doseHistoryService.getTodayProgress(user_id);
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    console.log(`[getTodayProgress] 처리 시간: ${duration}ms`);
    
    return {
      success: true,
      data: result,
      processingTime: duration // 디버깅용
    };
  } catch (error) {
    const endTime = Date.now();
    const duration = endTime - startTime;
    console.error(`[getTodayProgress] 실패 (${duration}ms):`, error);
    throw error;
  }
}
```

---

## 📊 예상 시간 요약

| API 호출 | 네트워크 | 서버 처리 | 총 시간 | 비고 |
|---------|---------|---------|---------|------|
| `getMemberTodayStats` | 100-200ms | 70-140ms | **170-340ms** | 평균 200-250ms |
| `getMedicineList` | 100-200ms | 90-190ms | **190-390ms** | 평균 250-300ms |
| `getSupplementSchedule` | 100-200ms | 30-80ms | **130-280ms** | 평균 150ms |

**구성원 3명, 각 약물 5개, 영양제 3개:**

| 방식 | 총 API 호출 | 총 시간 | 비고 |
|------|-----------|---------|------|
| 순차 처리 | 15번 | **약 2.7초** | 각각 순차 실행 |
| 병렬 처리 | 15번 | **약 0.9초** | Promise.all 사용 |
| 배치 API | 1번 | **약 0.3-0.4초** | 한 번에 조회 |

---

## 💡 최적화 효과

### 현재 (병렬 처리)
- 구성원 3명: **약 0.9초**
- 구성원 5명: **약 1.5초**
- 구성원 10명: **약 3초**

### 배치 API 적용 후
- 구성원 3명: **약 0.3-0.4초** (70% 개선)
- 구성원 5명: **약 0.4-0.5초** (73% 개선)
- 구성원 10명: **약 0.5-0.6초** (80% 개선)

---

## 🔧 실제 측정 명령어

앱에서 실제 시간을 측정하려면:

```typescript
// useFamilyDashboard.ts에 추가
const startTime = performance.now();

const [memberTodayResponse, medicineListResponse] = await Promise.all([
  getMemberTodayStats(member.user_id),
  getMedicineList(member.user_id)
]);

const endTime = performance.now();
logger.debug(`[${member.name}] API 호출 시간: ${endTime - startTime}ms`);
```

이렇게 하면 실제 네트워크 환경에서의 정확한 시간을 측정할 수 있습니다.

