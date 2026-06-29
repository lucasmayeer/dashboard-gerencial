import { useEffect, useState, useCallback } from "react";
import { loadData, Order } from "@/lib/data";
import { FilterProvider } from "@/lib/filters";
import { DashboardLayout } from "@/components/DashboardLayout";
import { ResumoMensalPage } from "./facilities/ResumoMensalPage";
import { OverviewPage } from "./facilities/OverviewPage";
import { TemporalPage } from "./facilities/TemporalPage";
import { DetailPage } from "./facilities/DetailPage";
import { EstoquePage } from "./facilities/EstoquePage";

interface IndexProps {
  page?: "resumo" | "overview" | "temporal" | "detail" | "estoque";
}

const Index = ({ page = "resumo" }: IndexProps) => {
  const [data, setData] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const fetchData = useCallback(async () => {
    const d = await loadData();
    setData(d);
    setLoading(false);
  }, []);

  const handleDataRefresh = useCallback(async () => {
    await fetchData();
    setRefreshKey((k) => k + 1);
  }, [fetchData]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // EstoquePage manages its own data, skip order loading spinner for it
  if (page === "estoque") {
    return (
      <FilterProvider data={data}>
        <DashboardLayout onDataRefresh={handleDataRefresh}>
          <EstoquePage key={refreshKey} />
        </DashboardLayout>
      </FilterProvider>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Carregando dados...</p>
        </div>
      </div>
    );
  }

  const renderPage = () => {
    switch (page) {
      case "overview": return <OverviewPage />;
      case "temporal": return <TemporalPage />;
      case "detail": return <DetailPage />;
      default: return <ResumoMensalPage />;
    }
  };

  return (
    <FilterProvider data={data}>
      <DashboardLayout onDataRefresh={handleDataRefresh}>
        {renderPage()}
      </DashboardLayout>
    </FilterProvider>
  );
};

export default Index;
