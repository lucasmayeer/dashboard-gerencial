import React, { createContext, useContext, useState, useMemo, useCallback, useEffect } from "react";
import { Order } from "./data";
import { ValidationReport, validateData } from "./dataValidation";
import { OUTLIER_THRESHOLD } from "./facilitiesUtils";

export interface Filters {
  status: string[];
  tipo: string[];
  cat: string[];
  subCat: string[];
  solicitante: string[];
  fornecedor: string[];
  mesRef: string[];
}

const emptyFilters: Filters = {
  status: [],
  tipo: [],
  cat: [],
  subCat: [],
  solicitante: [],
  fornecedor: [],
  mesRef: [],
};

interface FilterContextType {
  filters: Filters;
  setFilter: (key: keyof Filters, values: string[]) => void;
  clearFilters: () => void;
  filteredData: Order[];
  allData: Order[];
  activeFilterCount: number;
  removeOutliers: boolean;
  setRemoveOutliers: (v: boolean) => void;
  validationReport: ValidationReport | null;
  runValidation: () => void;
}

const FilterContext = createContext<FilterContextType | null>(null);

export function FilterProvider({ children, data }: { children: React.ReactNode; data: Order[] }) {
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [removeOutliers, setRemoveOutliers] = useState(true);
  const [validationReport, setValidationReport] = useState<ValidationReport | null>(null);

  const setFilter = useCallback((key: keyof Filters, values: string[]) => {
    setFilters((prev) => ({ ...prev, [key]: values }));
  }, []);

  const clearFilters = useCallback(() => setFilters(emptyFilters), []);

  const runValidation = useCallback(() => {
    if (data.length > 0) {
      setValidationReport(validateData(data));
    }
  }, [data]);

  // Auto-run validation when data changes
  useEffect(() => {
    if (data.length > 0) {
      setValidationReport(validateData(data));
    }
  }, [data]);

  const filteredData = useMemo(() => {
    return data.filter((order) => {
      if (removeOutliers && order.valorTotal > OUTLIER_THRESHOLD) return false;
      if (filters.status.length && !filters.status.includes(order.status)) return false;
      if (filters.tipo.length && !filters.tipo.includes(order.tipo)) return false;
      if (filters.cat.length && !filters.cat.includes(order.cat)) return false;
      if (filters.subCat.length && !filters.subCat.includes(order.subCat)) return false;
      if (filters.solicitante.length && !filters.solicitante.includes(order.solicitante)) return false;
      if (filters.fornecedor.length && !filters.fornecedor.includes(order.fornecedor)) return false;
      if (filters.mesRef.length && !filters.mesRef.includes(order.mesRef)) return false;
      return true;
    });
  }, [data, filters, removeOutliers]);

  const activeFilterCount = useMemo(() => {
    return Object.values(filters).reduce((sum, arr) => sum + (arr.length > 0 ? 1 : 0), 0);
  }, [filters]);

  return (
    <FilterContext.Provider value={{ filters, setFilter, clearFilters, filteredData, allData: data, activeFilterCount, removeOutliers, setRemoveOutliers, validationReport, runValidation }}>
      {children}
    </FilterContext.Provider>
  );
}

export function useFilters() {
  const ctx = useContext(FilterContext);
  if (!ctx) throw new Error("useFilters must be used within FilterProvider");
  return ctx;
}
