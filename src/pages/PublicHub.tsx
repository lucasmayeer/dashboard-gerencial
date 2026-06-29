import { useNavigate } from "react-router-dom";
import { LayoutDashboard } from "lucide-react";
import lucasMayerImg from "@/assets/lucas_mayer.png";
import rodrigoMarbaImg from "@/assets/rodrigo_marba.png";

export default function PublicHub() {
  const navigate = useNavigate();

  return (
    <>
      <div
        className="login-gradient-bg"
        style={{ flexDirection: "column", alignItems: "stretch", justifyContent: "space-between", padding: 0 }}
      >
        {/* Floating background orbs */}
        <div className="welcome-orb welcome-orb-1" />
        <div className="welcome-orb welcome-orb-2" />
        <div className="welcome-orb welcome-orb-3" />

        {/* Rising liquid-glass bubbles */}
        <div className="welcome-bubbles">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="welcome-bubble" />
          ))}
        </div>

        {/* HEADER */}
        <header
          className="welcome-animate welcome-animate-1"
          style={{ paddingTop: 36, paddingBottom: 28, display: "flex", flexDirection: "column", alignItems: "center", gap: 0 }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: "rgba(255,255,255,0.15)",
              display: "flex", alignItems: "center", justifyContent: "center",
              border: "1px solid rgba(255,255,255,0.2)",
            }}>
              <LayoutDashboard size={20} color="white" />
            </div>
            <span style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: 18,
              fontWeight: 700,
              color: "rgba(255,255,255,0.9)",
              letterSpacing: "-0.02em",
            }}>
              Dashboard Gerencial
            </span>
          </div>
        </header>

        {/* Main content */}
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 24px 40px" }}>
          <div style={{ display: "flex", gap: 128, maxWidth: 940, width: "100%", alignItems: "center" }}>

            {/* LEFT — title + access button */}
            <div
              className="welcome-animate welcome-animate-2"
              style={{ flex: 1, display: "flex", flexDirection: "column", gap: 28, alignItems: "flex-start" }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <h1 style={{
                  fontFamily: "'Inter', sans-serif",
                  fontSize: "clamp(1.5rem, 2.4vw, 3rem)",
                  fontWeight: 800,
                  lineHeight: 1.1,
                  color: "#ffffff",
                  margin: 0,
                  letterSpacing: "-0.035em",
                  textAlign: "left",
                }}>
                  <span className="animate-gradient-text-hub" style={{ display: "inline", fontWeight: 800 }}>Olá,</span><br />
                  <span style={{ color: "rgba(255,255,255,0.72)", fontWeight: 800 }}>
                    que bom te ver por aqui!
                  </span>
                </h1>
                <p style={{
                  fontFamily: "'Inter', sans-serif",
                  fontSize: 14.5,
                  color: "rgba(255,255,255,0.6)",
                  margin: 0,
                  lineHeight: 1.65,
                  fontWeight: 400,
                }}>
                  Relatório fictício para demonstrar um case real aplicado por Lucas Mayer e Rodrigo Marba.
                </p>
              </div>

              <button
                type="button"
                onClick={() => navigate("/reports")}
                className="btn-google-premium flex items-center justify-center gap-2.5"
                style={{ width: 560 }}
              >
                <LayoutDashboard size={18} color="white" />
                <span style={{ color: "#ffffff", fontWeight: 700 }}>Acessar Relatório</span>
              </button>
            </div>

          </div>
        </div>

        {/* FOOTER */}
        <footer style={{ paddingBottom: 56, paddingTop: 8, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 10, color: "rgba(255,255,255,0.28)", letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 500, margin: 0 }}>
            Desenvolvido por
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <a href="https://www.linkedin.com/in/lucasmayer00" target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "5px 12px", borderRadius: 999, background: "rgba(228,110,120,0.32)", border: "1px solid rgba(228,110,120,0.30)", backdropFilter: "blur(8px)", cursor: "pointer", transition: "opacity 0.15s, transform 0.15s" }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.opacity = "0.75"; (e.currentTarget as HTMLDivElement).style.transform = "scale(1.04)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.opacity = "1"; (e.currentTarget as HTMLDivElement).style.transform = "scale(1)"; }}
              >
                <img src={lucasMayerImg} alt="Lucas Mayer" style={{ width: 18, height: 18, borderRadius: "50%", objectFit: "cover" }} />
                <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 11.5, fontWeight: 500, color: "rgba(255,255,255,0.7)" }}>Lucas Mayer</span>
              </div>
            </a>
            <a href="https://www.linkedin.com/in/rodrigomarba" target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "5px 12px", borderRadius: 999, background: "rgba(228,169,0,0.2)", border: "1px solid rgba(228,169,0,0.25)", backdropFilter: "blur(8px)", cursor: "pointer", transition: "opacity 0.15s, transform 0.15s" }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.opacity = "0.75"; (e.currentTarget as HTMLDivElement).style.transform = "scale(1.04)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.opacity = "1"; (e.currentTarget as HTMLDivElement).style.transform = "scale(1)"; }}
              >
                <img src={rodrigoMarbaImg} alt="Rodrigo Marba" style={{ width: 18, height: 18, borderRadius: "50%", objectFit: "cover" }} />
                <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 11.5, fontWeight: 500, color: "rgba(255,255,255,0.7)" }}>Rodrigo Marba</span>
              </div>
            </a>
          </div>
        </footer>
      </div>
    </>
  );
}
