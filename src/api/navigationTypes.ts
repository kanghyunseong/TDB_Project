export type RootStackParamList = {
  Main: undefined;
  TabletScreen: undefined;
  MedicineEdit: {
    medicineId: string;
    memberId: string;
    medicineName: string;
    isParent: boolean;
  };
  MainMember: undefined;
  MedicineSchedule: {
    medicineId: string;
    memberId: string;
    medicineName: string;
    isParent: boolean;
    isReadOnly: boolean;
  };
  MedicineSearch: {
    searchType: 'medicine' | 'supplement';
  };
  MedicineDetail: {
    medicineId: string;
    memberId: string;
    medicineName: string;
    isParent: boolean;
  };
  SupplementDetail: {
    supplementId: string;
    memberId: string;
    supplementName: string;
    isParent: boolean;
  };
  SupplementSchedule: {
    supplementId: string;
    memberId: string;
    supplementName: string;
    isParent: boolean;
    isReadOnly: boolean;
  };
  // 다른 스크린들도 여기에 추가할 수 있습니다
}; 