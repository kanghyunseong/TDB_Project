import React, { createContext, useContext, useState, useEffect } from 'react';
// 🔥 JSON 파일 import 제거 (데이터베이스 사용)
// import supplementDataRaw from '../assets/tablet.json';
import { searchTabletMaster } from '../api/medicineMaster';

const SupplementContext = createContext<any[]>([]);

export const SupplementProvider = ({ children }: { children: React.ReactNode }) => {
  const [supplementData, setSupplementData] = useState<any[]>([]);

  useEffect(() => {
    // 🔥 서버 API에서 영양제 목록 로드 (빈 배열로 초기화, 필요시 검색 API 사용)
    // 실제 사용 시에는 검색 API를 통해 동적으로 로드
    setSupplementData([]);
  }, []);

  return (
    <SupplementContext.Provider value={supplementData}>
      {children}
    </SupplementContext.Provider>
  );
};

export const useSupplementList = () => useContext(SupplementContext);