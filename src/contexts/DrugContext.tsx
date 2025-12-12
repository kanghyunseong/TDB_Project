import React, { createContext, useContext, useState, useEffect } from 'react';
// 🔥 JSON 파일 import 제거 (데이터베이스 사용)
// import medicineDataRaw from '../assets/medicine.json';
import { searchMedicineMaster } from '../api/medicineMaster';

const DrugContext = createContext<any[]>([]);

export const DrugProvider = ({ children }: { children: React.ReactNode }) => {
  const [medicineData, setMedicineData] = useState<any[]>([]);

  useEffect(() => {
    // 🔥 서버 API에서 약물 목록 로드 (빈 배열로 초기화, 필요시 검색 API 사용)
    // 실제 사용 시에는 검색 API를 통해 동적으로 로드
    setMedicineData([]);
  }, []);

  return (
    <DrugContext.Provider value={medicineData}>
      {children}
    </DrugContext.Provider>
  );
};

export const useDrugList = () => useContext(DrugContext); 