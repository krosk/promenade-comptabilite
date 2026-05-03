import { useState, useEffect, useCallback, useRef } from "react";
import { FileUpload } from "./components/FileUpload";
import { LedgerView } from "./components/LedgerView";
import { RgdView } from "./components/RgdView";
import { initPyodide, parseGrandLivre, parseRgd, crossCheck } from "./pyodide/bridge";
import type { GrandLivre, Rgd, CrossReference, GlRef, RgdRef } from "./model/types";

type Tab = "upload" | "grand_livre" | "rgd";

function ProgressBar({ current, total, label }: { current: number; total: number; label: string }) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;
  return (
    <div style={{ padding: "1rem", background: "#eff6ff", border: "1px solid #93c5fd", borderRadius: 8, marginBottom: "1rem" }}>
      <div style={{ marginBottom: "0.5rem", fontSize: "0.875rem" }}>
        {label} — page {current}/{total}
      </div>
      <div style={{ background: "#dbeafe", borderRadius: 4, height: 8, overflow: "hidden" }}>
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: "#2563eb",
            borderRadius: 4,
            transition: "width 0.2s",
          }}
        />
      </div>
    </div>
  );
}

function App() {
  const [pyodideReady, setPyodideReady] = useState(false);
  const [pyodideError, setPyodideError] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [grandLivre, setGrandLivre] = useState<GrandLivre | null>(null);
  const [rgd, setRgd] = useState<Rgd | null>(null);
  const [crossRef, setCrossRef] = useState<CrossReference | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("upload");

  const navSeq = useRef(0);
  const [glNav, setGlNav] = useState<{ ref: GlRef; seq: number } | null>(null);
  const [rgdNav, setRgdNav] = useState<{ ref: RgdRef; seq: number } | null>(null);

  useEffect(() => {
    initPyodide()
      .then(() => setPyodideReady(true))
      .catch((err) => setPyodideError(String(err)));
  }, []);

  const handleGrandLivre = useCallback(async (bytes: Uint8Array) => {
    setLoading("Analyse du Grand Livre");
    setProgress(null);
    try {
      const result = await parseGrandLivre(bytes, (current, total) => {
        setProgress({ current, total });
      });
      setGrandLivre(result);
      setActiveTab("grand_livre");
    } catch (err) {
      alert(`Erreur lors de l'analyse : ${err}`);
    } finally {
      setLoading(null);
      setProgress(null);
    }
  }, []);

  const handleRgd = useCallback(async (bytes: Uint8Array) => {
    setLoading("Analyse du RGD");
    setProgress(null);
    try {
      const result = await parseRgd(bytes, (current, total) => {
        setProgress({ current, total });
      });
      setRgd(result);
      setActiveTab("rgd");
    } catch (err) {
      alert(`Erreur lors de l'analyse : ${err}`);
    } finally {
      setLoading(null);
      setProgress(null);
    }
  }, []);

  useEffect(() => {
    if (!grandLivre || !rgd) return;
    setCrossRef(null);
    crossCheck(grandLivre, rgd).then(setCrossRef).catch(console.error);
  }, [grandLivre, rgd]);

  function navigateToGl(ref: GlRef) {
    navSeq.current += 1;
    setGlNav({ ref, seq: navSeq.current });
    setActiveTab("grand_livre");
  }

  function navigateToRgd(ref: RgdRef) {
    navSeq.current += 1;
    setRgdNav({ ref, seq: navSeq.current });
    setActiveTab("rgd");
  }

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "1rem", fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>
        Promenade Comptabilité
      </h1>
      <p style={{ color: "#64748b", marginTop: 0, fontSize: "0.875rem" }}>
        Vérification des comptes de copropriété
      </p>

      {pyodideError && (
        <div style={{ padding: "1rem", background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8, marginBottom: "1rem" }}>
          Erreur d'initialisation : {pyodideError}
        </div>
      )}

      {!pyodideReady && !pyodideError && (
        <div style={{ padding: "1rem", background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 8, marginBottom: "1rem" }}>
          Chargement de l'environnement Python (première visite : ~15s)...
        </div>
      )}

      {loading && progress && (
        <ProgressBar current={progress.current} total={progress.total} label={loading} />
      )}

      {loading && !progress && (
        <div style={{ padding: "1rem", background: "#eff6ff", border: "1px solid #93c5fd", borderRadius: 8, marginBottom: "1rem" }}>
          {loading}...
        </div>
      )}

      <nav style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem", borderBottom: "2px solid #e2e8f0" }}>
        {([
          ["upload", "Import"],
          ["grand_livre", "Grand Livre"],
          ["rgd", "RGD"],
        ] as [Tab, string][]).map(([tab, label]) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            disabled={
              (tab === "grand_livre" && !grandLivre) ||
              (tab === "rgd" && !rgd)
            }
            style={{
              padding: "0.5rem 1rem",
              border: "none",
              borderBottom: activeTab === tab ? "2px solid #2563eb" : "2px solid transparent",
              background: "none",
              cursor: "pointer",
              fontWeight: activeTab === tab ? 600 : 400,
              color: activeTab === tab ? "#2563eb" : "#64748b",
              marginBottom: -2,
            }}
          >
            {label}
          </button>
        ))}
      </nav>

      {activeTab === "upload" && (
        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 280 }}>
            <FileUpload
              label="Grand Livre"
              onFileSelected={handleGrandLivre}
              disabled={!pyodideReady || !!loading}
            />
          </div>
          <div style={{ flex: 1, minWidth: 280 }}>
            <FileUpload
              label="Relevé Général des Dépenses"
              onFileSelected={handleRgd}
              disabled={!pyodideReady || !!loading}
            />
          </div>
        </div>
      )}

      {activeTab === "grand_livre" && grandLivre && (
        <LedgerView
          data={grandLivre}
          xref={crossRef}
          navigateTo={glNav}
          onNavigateToRgd={navigateToRgd}
        />
      )}

      {activeTab === "rgd" && rgd && (
        <RgdView
          data={rgd}
          xref={crossRef}
          navigateTo={rgdNav}
          onNavigateToGl={navigateToGl}
        />
      )}
    </div>
  );
}

export default App;
