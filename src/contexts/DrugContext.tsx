import React, { createContext, useContext } from 'react';
import medicineDataRaw from '../assets/medicine.json';
const medicineData: any[] = medicineDataRaw as any[];

console.log('medicineData 타입:', Array.isArray(medicineData), medicineData.length);

const DrugContext = createContext<any[]>(medicineData);

export const DrugProvider = ({ children }: { children: React.ReactNode }) => (
  <DrugContext.Provider value={medicineData}>
    {children}
  </DrugContext.Provider>
);

export const useDrugList = () => useContext(DrugContext); 