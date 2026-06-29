import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Building2, TrendingUp, LogOut, Layers, Info } from "lucide-react";
import lucasMayerImg from "@/assets/lucas_mayer.png";
import rodrigoMarbaImg from "@/assets/rodrigo_marba.png";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useMemo } from "react";
interface Report {
  id: string;
  title: string;
  description: string;
  icon: typeof Building2;
  path: string | null;
  available: boolean;
}

const reports: Report[] = [
  {
    id: "facilities",
    title: "Gestão de Custos",
    description: "Controle completo de custos, estoque e operações de Facilities",
    icon: Building2,
    path: "/facilities",
    available: true,
    module: "facilities",
  },
  {
    id: "direct-sales",
    title: "Departamento Vendas",
    description: "Análise de performance e métricas do time de vendas",
    icon: TrendingUp,
    path: "/direct-sales-desempenho-mensal",
    available: true,
    module: "direct-sales",
    rankingPath: "/direct-sales/ranking",
  },
  {
    id: "business-systems-analyst",
    title: "Departamento de Implantação",
    description: "Análise de sistemas, processos e indicadores de negócio",
    icon: Layers,
    path: "/bsa",
    available: true,
    module: "bsa",
    rankingPath: "/bsa/ranking",
  },
];

export default function ReportsHub() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const avatarUrl = user?.user_metadata?.avatar_url;
  const fullName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Usuário";
  const initials = fullName
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const sortedReports = useMemo(
    () => [...reports].sort((a, b) => a.title.localeCompare(b.title)),
    []
  );

  const handleCardClick = (report: Report) => {
    if (report.available && report.path) {
      navigate(report.path);
    }
  };

  return (
    <div className="login-gradient-bg !items-start pt-8 sm:pt-12">
      <div className="w-full max-w-4xl mx-auto px-4 relative z-10">
        {/* Top bar */}
        <div className="flex items-center justify-end gap-2 mb-8">
          <button
            onClick={() => navigate("/welcome")}
            className="p-2 rounded-full hover:bg-white/10 transition-colors"
            aria-label="Voltar ao início"
          >
            <LogOut className="h-4 w-4 text-white" />
          </button>
        </div>

        {/* Welcome section — horizontal layout */}
        <div className="flex items-center gap-4 mb-10 justify-center">
          <Avatar className="h-14 w-14 sm:h-16 sm:w-16 ring-2 ring-white/20 shadow-lg shrink-0">
            <AvatarImage src={avatarUrl} alt={fullName} />
            <AvatarFallback className="text-lg font-semibold text-white" style={{ background: "#E46E78" }}>
              {initials}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">
              <span className="text-white/90">Bem-vindo, </span>
              <span className="animate-gradient-text-hub">{fullName}</span>
            </h1>
            <p className="text-sm text-white/60">
              Escolha um relatório para acessar
            </p>
          </div>
        </div>

        {/* Reports grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 max-w-4xl mx-auto">
          {sortedReports.map((report) => (
            <button
              key={report.id}
              onClick={() => handleCardClick(report)}
              className="relative w-full rounded-3xl p-6 text-center backdrop-blur-xl bg-white/8 border border-white/15 shadow-[0_20px_50px_rgba(0,0,0,0.25)] transition-all duration-300 hover:-translate-y-1 hover:scale-[1.02] hover:shadow-[0_30px_60px_rgba(0,0,0,0.35)] hover:bg-white/12 active:scale-[0.98] group overflow-hidden"
            >
              <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-white/15 to-white/0 pointer-events-none" />
              <div className="relative z-[1] flex flex-col items-center gap-3">
                <div className="rounded-xl bg-white/10 p-3 text-white group-hover:bg-white/20 transition-colors animate-gradient-text-hub-icon">
                  <report.icon className="h-7 w-7" />
                </div>
                <h2 className="text-lg font-semibold text-white">{report.title}</h2>
                <p className="text-sm text-white/60 leading-relaxed">{report.description}</p>
              </div>
            </button>
          ))}
        </div>

        {/* Callout — dados fictícios */}
        <div className="mt-12 mx-auto max-w-2xl rounded-2xl backdrop-blur-xl flex items-start gap-3.5 px-5 py-4"
          style={{
            background: "rgba(228,169,0,0.07)",
            border: "1px solid rgba(228,169,0,0.22)",
          }}
        >
          <Info className="h-4 w-4 shrink-0 mt-0.5" style={{ color: "rgba(228,169,0,0.65)" }} />
          <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.50)", margin: 0 }}>
            <span className="font-semibold" style={{ color: "rgba(228,169,0,0.80)" }}>Dados fictícios para fins de portfólio.</span>
            {" "}Este dashboard é baseado em um case real, utilizado atualmente por uma empresa parceira, e foi adaptado como projeto de portfólio.
            Todos os números, nomes, métricas e registros exibidos são gerados artificialmente e não representam informações reais da organização.
          </p>
        </div>

        {/* Footer */}
        <footer className="mt-10 mb-8 text-center">
          <p className="text-xs text-white/40 mb-2 tracking-wider font-medium">Relatório criado por</p>
          <div className="flex items-center justify-center gap-3">
            <a href="https://www.linkedin.com/in/lucasmayer00" target="_blank" rel="noopener noreferrer" className="no-underline">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full backdrop-blur-xl border border-white/10 shadow-md transition-[opacity,transform] duration-150 hover:opacity-75 hover:scale-[1.04] cursor-pointer" style={{ background: "rgba(228, 110, 120, 0.35)" }}>
                <img src={lucasMayerImg} alt="Lucas Mayer" className="h-6 w-6 rounded-full object-cover" />
                <span className="text-xs font-medium text-white">Lucas Mayer</span>
              </div>
            </a>
            <a href="https://www.linkedin.com/in/rodrigomarba" target="_blank" rel="noopener noreferrer" className="no-underline">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full backdrop-blur-xl border border-white/10 shadow-md transition-[opacity,transform] duration-150 hover:opacity-75 hover:scale-[1.04] cursor-pointer" style={{ background: "rgba(228, 169, 0, 0.3)" }}>
                <img src={rodrigoMarbaImg} alt="Rodrigo Marba" className="h-6 w-6 rounded-full object-cover" />
                <span className="text-xs font-medium text-white">Rodrigo Marba</span>
              </div>
            </a>
          </div>
        </footer>
      </div>
    </div>
  );
}
