import { useState, useCallback } from 'react';
import Toast from 'react-native-toast-message';
import { scheduleApi } from '../api/schedule';
import { scheduleDispense } from '../api/dispenser';
import { userApi } from '../api/users';
import { Medicine, FamilyMember } from '../types/tdb';
import { logger } from '../utils/logger';
import { API_ENDPOINTS } from '../constants/api';
import { apiClient } from '../api/client';

interface UseDoseCompletionProps {
  selectedMember: FamilyMember | null;
  dailySchedules: Record<string, { morning: number; afternoon: number; evening: number }>;
  loadDailySchedule: (medicineId: string, userId: string) => Promise<void>;
  loadDoseCompletionStatus: (medicineId: string, userId: string) => Promise<{
    morning: boolean;
    afternoon: boolean;
    evening: boolean;
  }>;
  setDoseCompletionStatus: React.Dispatch<React.SetStateAction<Record<string, {
    morning: boolean;
    afternoon: boolean;
    evening: boolean;
  }>>>;
  handleSelectMember?: (member: FamilyMember) => Promise<void>;
}

export const useDoseCompletion = ({
  selectedMember,
  dailySchedules,
  loadDailySchedule,
  loadDoseCompletionStatus,
  setDoseCompletionStatus,
  handleSelectMember,
}: UseDoseCompletionProps) => {
  const [completingDose, setCompletingDose] = useState<Record<string, boolean>>({});

  // 🔥 복용 완료 처리 함수 (기본)
  const handleCompleteDose = useCallback(async (
    medicine: Medicine,
    timeOfDay: 'morning' | 'afternoon' | 'evening'
  ) => {
    if (!selectedMember) {
      Toast.show({
        type: 'error',
        text1: '가족 구성원을 선택해주세요.',
        position: 'bottom',
      });
      return;
    }

    const completionKey = `${medicine.medi_id}_${selectedMember.user_id}_${timeOfDay}`;

    // 이미 처리 중인 경우 중복 호출 방지
    if (completingDose[completionKey]) {
      return;
    }

    try {
      setCompletingDose(prev => ({ ...prev, [completionKey]: true }));

      // 스케줄에서 복용량 가져오기
      const scheduleKey = `${medicine.medi_id}_${selectedMember.user_id}`;
      const dailySchedule = dailySchedules[scheduleKey];

      let actualDose = 1; // 기본값
      if (dailySchedule) {
        actualDose = timeOfDay === 'morning' ? dailySchedule.morning :
          timeOfDay === 'afternoon' ? dailySchedule.afternoon :
          dailySchedule.evening;
      }

      if (actualDose === 0) {
        Toast.show({
          type: 'warning',
          text1: '해당 시간대에 복용 스케줄이 없습니다.',
          position: 'bottom',
        });
        return;
      }

      // API 호출
      const response = await scheduleApi.completeDose(
        medicine.medi_id,
        selectedMember.user_id,
        timeOfDay,
        actualDose
      );

      if (response.success) {
        Toast.show({
          type: 'success',
          text1: '복용 완료',
          text2: `${actualDose}정 복용이 기록되었습니다.`,
          position: 'bottom',
        });

        // 🔥 복용 완료 상태 즉시 업데이트 (안정적으로 처리)
        const statusKey = `${medicine.medi_id}_${selectedMember.user_id}`;
        setDoseCompletionStatus(prev => {
          const prevStatus = prev[statusKey];
          const newStatus = {
            morning: prevStatus?.morning || false,
            afternoon: prevStatus?.afternoon || false,
            evening: prevStatus?.evening || false,
            [timeOfDay]: true
          };
          
          // 🔥 실제로 변경된 경우에만 업데이트 (깜빡임 방지)
          if (prevStatus && 
              prevStatus.morning === newStatus.morning &&
              prevStatus.afternoon === newStatus.afternoon &&
              prevStatus.evening === newStatus.evening) {
            return prev; // 변경사항 없으면 이전 상태 반환
          }
          
          return {
            ...prev,
            [statusKey]: newStatus
          };
        });

        // 🔥 즉시 데이터 새로고침
        if (selectedMember) {
          await Promise.all([
            loadDailySchedule(medicine.medi_id, selectedMember.user_id),
            loadDoseCompletionStatus(medicine.medi_id, selectedMember.user_id)
          ]).then(([, status]) => {
            // 🔥 새로 조회한 상태로 업데이트 (안정적으로 처리)
            if (status) {
              setDoseCompletionStatus(prev => {
                const prevStatus = prev[statusKey];
                // 🔥 실제로 변경된 경우에만 업데이트
                if (prevStatus && 
                    prevStatus.morning === status.morning &&
                    prevStatus.afternoon === status.afternoon &&
                    prevStatus.evening === status.evening) {
                  return prev; // 변경사항 없으면 이전 상태 반환
                }
                return {
                  ...prev,
                  [statusKey]: status
                };
              });
            }
          });

          logger.debug(`상태 업데이트 완료: ${statusKey}`);
        }
      } else {
        throw new Error(response.error?.message || '복용 기록 저장에 실패했습니다.');
      }

    } catch (error) {
      logger.error('복용 완료 처리 에러', error);
      Toast.show({
        type: 'error',
        text1: '오류',
        text2: error instanceof Error ? error.message : '복용 완료 처리에 실패했습니다.',
        position: 'bottom',
      });
    } finally {
      setCompletingDose(prev => ({ ...prev, [completionKey]: false }));
    }
  }, [selectedMember, dailySchedules, completingDose, loadDailySchedule, loadDoseCompletionStatus, setDoseCompletionStatus]);

  // 🔥 복용 완료 처리 함수 (target_users 기반) - 실제 약물 배출 포함
  const handleCompleteDoseWithTarget = useCallback(async (
    medicine: Medicine,
    timeOfDay: 'morning' | 'afternoon' | 'evening',
    targetUserId: string
  ) => {
    if (!selectedMember) {
      Toast.show({
        type: 'error',
        text1: '가족 구성원을 선택해주세요.',
        position: 'bottom',
      });
      return;
    }

    const completionKey = `${medicine.medi_id}_${targetUserId}_${timeOfDay}`;

    // 이미 처리 중인 경우 중복 호출 방지
    if (completingDose[completionKey]) {
      return;
    }

    try {
      setCompletingDose(prev => ({ ...prev, [completionKey]: true }));

      // 스케줄에서 복용량 가져오기 (target_users 기반)
      const scheduleKey = `${medicine.medi_id}_${targetUserId}`;
      const dailySchedule = dailySchedules[scheduleKey];

      let actualDose = 1; // 기본값
      if (dailySchedule) {
        actualDose = timeOfDay === 'morning' ? dailySchedule.morning :
          timeOfDay === 'afternoon' ? dailySchedule.afternoon :
          dailySchedule.evening;
      }

      if (actualDose === 0) {
        Toast.show({
          type: 'warning',
          text1: '해당 시간대에 복용 스케줄이 없습니다.',
          position: 'bottom',
        });
        return;
      }

      // 🔥 1단계: 오늘 스케줄에 따른 약물 배출 실행
      logger.log('스케줄 기반 배출 시작', {
        medicine: medicine.name,
        dose: actualDose,
        timeOfDay,
        targetUser: targetUserId,
        today: new Date().toISOString().split('T')[0]
      });

      // 사용자의 machine_id 조회
      const machineIdResponse = await userApi.getUserMachineId(targetUserId);
      if (!machineIdResponse.success || !machineIdResponse.data?.machine_id) {
        throw new Error('디스펜서 기기 정보를 찾을 수 없습니다.');
      }

      const machine_id = machineIdResponse.data.machine_id;

      // 약물 배출 API 호출
      const dispenseResult = await scheduleDispense(
        machine_id,
        targetUserId,
        medicine.medi_id,
        medicine.slot || 1,
        actualDose,
        `${timeOfDay} 복용`
      );

      if (!dispenseResult.success) {
        throw new Error(dispenseResult.error?.message || '약물 배출에 실패했습니다.');
      }

      // 🔥 2단계: 복용 기록 저장
      const response = await scheduleApi.completeDose(
        medicine.medi_id,
        targetUserId,
        timeOfDay,
        actualDose
      );

      if (!response.success) {
        throw new Error(response.error?.message || '복용 기록 저장에 실패했습니다.');
      }

      const timeLabel = timeOfDay === 'morning' ? '아침' :
        timeOfDay === 'afternoon' ? '점심' : '저녁';
      Toast.show({
        type: 'success',
        text1: `${timeLabel} 복용 완료`,
        text2: `${medicine.name} ${actualDose}정이 스케줄에 따라 배출되었습니다.`,
        position: 'bottom',
      });

      // 🔥 복용 완료 상태 즉시 업데이트 (target_users 기반)
      const statusKey = `${medicine.medi_id}_${targetUserId}`;
      setDoseCompletionStatus(prev => ({
        ...prev,
        [statusKey]: {
          morning: prev[statusKey]?.morning || false,
          afternoon: prev[statusKey]?.afternoon || false,
          evening: prev[statusKey]?.evening || false,
          [timeOfDay]: true
        }
      }));

      // 🔥 즉시 데이터 새로고침 (target_users 기반)
      await loadDailySchedule(medicine.medi_id, targetUserId);
      const status = await loadDoseCompletionStatus(medicine.medi_id, targetUserId);
      // 🔥 statusKey는 위에서 이미 선언됨 (재사용)
      setDoseCompletionStatus(prev => ({
        ...prev,
        [statusKey]: status
      }));

      logger.debug(`배출 완료: ${statusKey}`);

    } catch (error) {
      logger.error('약물 배출/복용 완료 처리 에러', error);
      Toast.show({
        type: 'error',
        text1: '복용 실패',
        text2: error instanceof Error ? error.message : '복용 처리에 실패했습니다.',
        position: 'bottom',
      });
    } finally {
      setCompletingDose(prev => ({ ...prev, [completionKey]: false }));
    }
  }, [selectedMember, dailySchedules, completingDose, loadDailySchedule, loadDoseCompletionStatus, setDoseCompletionStatus]);

  // 🔥 하루치 배출 및 복용 완료 처리
  const handleCompleteDailySchedule = useCallback(async (
    medicine: Medicine,
    targetUserId: string
  ) => {
    const completingKey = `${medicine.medi_id}_${targetUserId}_daily`;

    try {
      setCompletingDose(prev => ({ ...prev, [completingKey]: true }));

      logger.log('하루 전체 스케줄 배출 시작', {
        medicine: medicine.name,
        targetUserId,
        schedule: dailySchedules[`${medicine.medi_id}_${targetUserId}`]
      });

      const scheduleKey = `${medicine.medi_id}_${targetUserId}`;
      const dailySchedule = dailySchedules[scheduleKey];

      if (!dailySchedule) {
        throw new Error('스케줄 정보를 찾을 수 없습니다.');
      }

      const totalDose = dailySchedule.morning + dailySchedule.afternoon + dailySchedule.evening;

      // 슬롯 정보 확인
      if (!medicine.slot) {
        throw new Error('약물 슬롯 정보가 없습니다.');
      }

      if (totalDose === 0) {
        Toast.show({
          type: 'warning',
          text1: '오늘 복용할 약이 없습니다.',
          position: 'bottom',
        });
        return;
      }

      // 1. 실제 약물 배출 (하루치 전체)
      let machine_id: string;

      try {
        const machineIdResponse = await userApi.getUserMachineId(targetUserId);
        if (!machineIdResponse.success || !machineIdResponse.data?.machine_id) {
          throw new Error('기기 정보를 찾을 수 없습니다.');
        }
        machine_id = machineIdResponse.data.machine_id;

        logger.log('하루치 배출 요청', {
          machine_id,
          medi_id: medicine.medi_id,
          slot: medicine.slot,
          count: totalDose
        });

        const dispenseResult = await scheduleDispense(
          machine_id,
          targetUserId,
          medicine.medi_id,
          medicine.slot,
          totalDose,
          '하루치 일괄 배출'
        );

        if (!dispenseResult.success) {
          throw new Error(dispenseResult.error?.message || '배출에 실패했습니다.');
        }

        logger.log('하루치 배출 성공');
      } catch (dispenseError) {
        logger.error('배출 실패', dispenseError);
        throw new Error(`배출 실패: ${dispenseError instanceof Error ? dispenseError.message : '알 수 없는 오류'}`);
      }

      // 2. 모든 시간대 복용 기록 저장
      const timeSlots = ['morning', 'afternoon', 'evening'] as const;

      for (const timeOfDay of timeSlots) {
        const dosage = dailySchedule[timeOfDay];
        if (dosage > 0) {
          try {
            const response = await scheduleApi.completeDose(medicine.medi_id, targetUserId, timeOfDay, dosage);
            if (!response.success) {
              logger.error(`${timeOfDay} 복용 기록 실패`, response.error);
            } else {
              logger.log(`${timeOfDay} 복용 기록 성공`);
            }
          } catch (recordError) {
            logger.error(`${timeOfDay} 복용 기록 오류`, recordError);
          }
        }
      }

      Toast.show({
        type: 'success',
        text1: '📦 하루치 배출 완료',
        text2: `${medicine.name} 총 ${totalDose}정이 배출되었습니다. 데일리키트에 나눠서 보관하세요.`,
        position: 'top',
        visibilityTime: 4000,
      });

      // 3. 복용 완료 상태 즉시 업데이트
      setDoseCompletionStatus(prev => ({
        ...prev,
        [medicine.medi_id]: {
          morning: true,
          afternoon: true,
          evening: true
        }
      }));

      // 4. 약물 목록 새로고침
      if (handleSelectMember && selectedMember) {
        await handleSelectMember(selectedMember);
      }

    } catch (error) {
      logger.error('하루치 배출/복용 완료 처리 에러', error);
      Toast.show({
        type: 'error',
        text1: '배출 실패',
        text2: error instanceof Error ? error.message : '하루치 배출 처리에 실패했습니다.',
        position: 'top',
      });
    } finally {
      setCompletingDose(prev => ({ ...prev, [completingKey]: false }));
    }
  }, [dailySchedules, selectedMember, handleSelectMember, setDoseCompletionStatus, completingDose]);

  return {
    completingDose,
    handleCompleteDose,
    handleCompleteDoseWithTarget,
    handleCompleteDailySchedule,
  };
};

