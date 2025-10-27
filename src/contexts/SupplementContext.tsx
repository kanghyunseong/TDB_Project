import React, { createContext, useContext } from 'react';
import supplementDataRaw from '../assets/tablet.json';
const supplementData: any[] = supplementDataRaw as any[];

const SupplementContext = createContext<any[]>(supplementData);

export const SupplementProvider = ({ children }: { children: React.ReactNode }) => (
  <SupplementContext.Provider value={supplementData}>
    {children}
  </SupplementContext.Provider>
);

export const useSupplementList = () => useContext(SupplementContext);