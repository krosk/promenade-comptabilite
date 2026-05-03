import { useState, useEffect } from "react";
import type { Rgd, CrossReference, GlRef, RgdRef } from "../model/types";

function formatNumber(n: number | null): string {
  if (n === null || n === undefined) return "";
  return n.toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

const linkStyle: React.CSSProperties = {
  cursor: "pointer",
  color: "#2563eb",
  fontSize: "0.65rem",
  padding: "0.1rem 0.3rem",
  border: "1px solid #93c5fd",
  borderRadius: "3px",
  userSelect: "none",
  whiteSpace: "nowrap",
  background: "#eff6ff",
};

function rgdKey(cleIndex: number, acctNumero: string, entryIndex: number) {
  return `${cleIndex}:${acctNumero}:${entryIndex}`;
}

interface Props {
  data: Rgd;
  xref: CrossReference | null;
  navigateTo: { ref: RgdRef; seq: number } | null;
  onNavigateToGl: (ref: GlRef) => void;
}

export function RgdView({ data, xref, navigateTo, onNavigateToGl }: Props) {
  const [expandedCles, setExpandedCles] = useState<Set<string>>(new Set());
  const [expandedAccounts, setExpandedAccounts] = useState<Set<string>>(new Set());
  const [highlightId, setHighlightId] = useState<string | null>(null);

  function toggleCle(key: string) {
    setExpandedCles((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  function toggleAccount(key: string) {
    setExpandedAccounts((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  function expandAll() {
    setExpandedCles(new Set(data.cles.map((c) => c.nom)));
    const accountKeys = data.cles.flatMap((c) => c.accounts.map((a) => `${c.nom}::${a.numero}`));
    setExpandedAccounts(new Set(accountKeys));
  }

  function collapseAll() {
    setExpandedCles(new Set());
    setExpandedAccounts(new Set());
  }

  useEffect(() => {
    if (!navigateTo) return;
    const { cleIndex, acctNumero, entryIndex } = navigateTo.ref;
    const cle = data.cles[cleIndex];
    if (!cle) return;
    setExpandedCles((prev) => new Set([...prev, cle.nom]));
    setExpandedAccounts((prev) => new Set([...prev, `${cle.nom}::${acctNumero}`]));
    const id = `rgd-${cleIndex}-${acctNumero}-${entryIndex}`;
    setHighlightId(id);
    setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "center" }), 60);
    setTimeout(() => setHighlightId(null), 1800);
  }, [navigateTo?.seq]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      <h3>
        Relevé Général des Dépenses — {data.periode.from} au {data.periode.to}
      </h3>
      <p style={{ color: "#64748b" }}>
        {data.cles.length} clés de répartition |
        Total dépenses : {formatNumber(data.total_depenses)}
      </p>

      <div style={{ marginBottom: "0.75rem", display: "flex", gap: "0.5rem" }}>
        <button onClick={expandAll} style={{ fontSize: "0.8rem", padding: "0.25rem 0.75rem", cursor: "pointer" }}>
          Tout ouvrir
        </button>
        <button onClick={collapseAll} style={{ fontSize: "0.8rem", padding: "0.25rem 0.75rem", cursor: "pointer" }}>
          Tout fermer
        </button>
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
        <thead>
          <tr style={{ background: "#f1f5f9", textAlign: "left" }}>
            <th style={{ padding: "0.5rem", width: "1.5rem" }}></th>
            <th style={{ padding: "0.5rem" }}>Clé</th>
            <th style={{ padding: "0.5rem" }}>Nom</th>
            <th style={{ padding: "0.5rem", textAlign: "center" }}>Comptes</th>
            <th style={{ padding: "0.5rem", textAlign: "right" }}>Total TTC</th>
          </tr>
        </thead>
        <tbody>
          {data.cles.map((cle, ci) => {
            const cleOpen = expandedCles.has(cle.nom);
            return (
              <>
                <tr
                  key={cle.nom}
                  onClick={() => toggleCle(cle.nom)}
                  style={{
                    borderBottom: "1px solid #e2e8f0",
                    cursor: "pointer",
                    background: cleOpen ? "#eff6ff" : "transparent",
                  }}
                >
                  <td style={{ padding: "0.5rem", color: "#94a3b8", fontSize: "0.7rem", userSelect: "none" }}>
                    {cleOpen ? "▼" : "▶"}
                  </td>
                  <td style={{ padding: "0.5rem", fontFamily: "monospace" }}>{cle.numero}</td>
                  <td style={{ padding: "0.5rem" }}>{cle.nom}</td>
                  <td style={{ padding: "0.5rem", textAlign: "center" }}>{cle.accounts.length}</td>
                  <td style={{ padding: "0.5rem", textAlign: "right" }}>{formatNumber(cle.total)}</td>
                </tr>
                {cleOpen && (
                  <tr key={`${cle.nom}-detail`}>
                    <td
                      colSpan={5}
                      style={{
                        padding: "0.5rem 0.5rem 0.75rem 2rem",
                        background: "#f8fafc",
                        borderBottom: "2px solid #cbd5e1",
                      }}
                    >
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.825rem" }}>
                        <thead>
                          <tr style={{ background: "#e2e8f0", textAlign: "left" }}>
                            <th style={{ padding: "0.25rem 0.5rem", width: "1.5rem" }}></th>
                            <th style={{ padding: "0.25rem 0.5rem" }}>Compte</th>
                            <th style={{ padding: "0.25rem 0.5rem" }}>Libellé</th>
                            <th style={{ padding: "0.25rem 0.5rem", textAlign: "center" }}>Lignes</th>
                            <th style={{ padding: "0.25rem 0.5rem", textAlign: "right" }}>Sous-total TTC</th>
                          </tr>
                        </thead>
                        <tbody>
                          {cle.accounts.map((acct) => {
                            const acctKey = `${cle.nom}::${acct.numero}`;
                            const acctOpen = expandedAccounts.has(acctKey);
                            return (
                              <>
                                <tr
                                  key={acctKey}
                                  onClick={(e) => { e.stopPropagation(); toggleAccount(acctKey); }}
                                  style={{
                                    borderBottom: "1px solid #e2e8f0",
                                    cursor: "pointer",
                                    background: acctOpen ? "#dbeafe" : "transparent",
                                  }}
                                >
                                  <td style={{ padding: "0.25rem 0.5rem", color: "#94a3b8", fontSize: "0.65rem", userSelect: "none" }}>
                                    {acctOpen ? "▼" : "▶"}
                                  </td>
                                  <td style={{ padding: "0.25rem 0.5rem", fontFamily: "monospace" }}>{acct.numero}</td>
                                  <td style={{ padding: "0.25rem 0.5rem" }}>{acct.label}</td>
                                  <td style={{ padding: "0.25rem 0.5rem", textAlign: "center" }}>{acct.entries.length}</td>
                                  <td style={{ padding: "0.25rem 0.5rem", textAlign: "right" }}>{formatNumber(acct.sous_total)}</td>
                                </tr>
                                {acctOpen && (
                                  <tr key={`${acctKey}-entries`}>
                                    <td
                                      colSpan={5}
                                      style={{
                                        padding: "0.4rem 0.4rem 0.6rem 2rem",
                                        background: "#eff6ff",
                                        borderBottom: "1px solid #bfdbfe",
                                      }}
                                    >
                                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.75rem" }}>
                                        <thead>
                                          <tr style={{ background: "#dbeafe", textAlign: "left" }}>
                                            <th style={{ padding: "0.2rem 0.4rem" }}>Date</th>
                                            <th style={{ padding: "0.2rem 0.4rem" }}>Libellé</th>
                                            <th style={{ padding: "0.2rem 0.4rem" }}>Fournisseur</th>
                                            <th style={{ padding: "0.2rem 0.4rem", textAlign: "right" }}>TTC</th>
                                            <th style={{ padding: "0.2rem 0.4rem" }}></th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {acct.entries.map((e, ei) => {
                                            const id = `rgd-${ci}-${acct.numero}-${ei}`;
                                            const glRef = xref?.rgdToGl[rgdKey(ci, acct.numero, ei)];
                                            const isHighlighted = highlightId === id;
                                            return (
                                              <tr
                                                key={ei}
                                                id={id}
                                                style={{
                                                  borderBottom: "1px solid #bfdbfe",
                                                  background: isHighlighted ? "#fef08a" : "transparent",
                                                  transition: "background 0.4s",
                                                }}
                                              >
                                                <td style={{ padding: "0.2rem 0.4rem", whiteSpace: "nowrap" }}>{e.date}</td>
                                                <td style={{ padding: "0.2rem 0.4rem" }}>{e.libelle}</td>
                                                <td style={{ padding: "0.2rem 0.4rem" }}>{e.fournisseur}</td>
                                                <td style={{ padding: "0.2rem 0.4rem", textAlign: "right" }}>{formatNumber(e.montant_ttc)}</td>
                                                <td style={{ padding: "0.2rem 0.4rem" }}>
                                                  {glRef && (
                                                    <span
                                                      onClick={(ev) => { ev.stopPropagation(); onNavigateToGl(glRef); }}
                                                      title="Voir dans le Grand Livre"
                                                      style={linkStyle}
                                                    >
                                                      GL ↗
                                                    </span>
                                                  )}
                                                </td>
                                              </tr>
                                            );
                                          })}
                                        </tbody>
                                      </table>
                                    </td>
                                  </tr>
                                )}
                              </>
                            );
                          })}
                        </tbody>
                      </table>
                    </td>
                  </tr>
                )}
              </>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
