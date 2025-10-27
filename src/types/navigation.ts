import { authNavigations, mainNavigations } from '../constants/navigation';
import { User, MedicineSchedule } from '../types/tdb';

// MainStackParamList를 RootStackParamList로도 내보내기
export type RootStackParamList = MainStackParamList;

export type AuthStackParamList = {
  [authNavigations.AUTH_HOME]: undefined;
  [authNavigations.LOGIN]: undefined;
  [authNavigations.SIGNUP]: undefined;
};

export type BottomTabParamList = {
  [mainNavigations.HOME]: undefined;
  [mainNavigations.MEMBER]: undefined;
  [mainNavigations.MEDICINE]: { screen?: string; params?: any };
  [mainNavigations.MEDICINE_SCHEDULE]: undefined;
  [mainNavigations.SETTINGS]: {
    scannedData?: string;
    scanType?: 'dispenser' | 'dailyKit';
  };
};

export type MainStackParamList = {
  Home: undefined;
  MedicineSearch: {
    searchType: 'medicine' | 'supplement';
  };
  MedicineDetail: {
    medicineId: string;
    medicineName: string;
    memberId: string;
    isParent: boolean;
    detail?: any;
  };
  ItemDetail: {
    itemType: 'medicine' | 'supplement';
    itemName: string;
    itemData?: any;
  };
  MedicineEdit: {
    medicineId: string;
    memberId: string;
    medicineName: string;
    isParent: boolean;
  };
  MedicineSchedule: {
    medicineId: string;
    memberId: string;
    medicineName: string;
    isParent: boolean;
    isReadOnly: boolean;
  };
  MedicineScheduleEdit: {
    medicineId: string;
    memberId: string;
    medicineName: string;
    slot?: number;
    useMethodQesitm?: string;  // 🔥 처방 정보 (용법용량)
    onScheduleUpdate?: (updatedSchedules: Record<string, MedicineSchedule>) => void;
    isReadOnly?: boolean;
  };
  MemberDetail: {
    memberId: string;
  };
  FamilyWeeklyStats: undefined;
  DoseTimeSetting: {
    memberId?: string;
  };
  MonthlyReport: undefined;
  MainTabs: {
    screen: keyof BottomTabParamList;
    params?: any;
  };
  QRScanner: {
    scanType: 'dispenser' | 'dailyKit';
  };
  Tablet: undefined;
  SupplementDetail: {
    supplement: any;
    memberId: string;
    isParent: boolean;
    isStoredSupplement?: boolean;
    storedData?: any;
  };
  SupplementEdit: {
    supplementId: string;
    memberId: string;
    supplementName: string;
    isParent: boolean;
  };
  SupplementScheduleEdit: {
    supplementId: string;
    memberId: string;
    supplementName: string;
    slot?: number;
  };
  Auth: {
    screen: keyof AuthStackParamList;
  };
}; 