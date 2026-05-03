import { useState, useEffect } from "react";
import type { GrandLivre, CrossReference, RgdRef, GlRef } from "../model/types";

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

function glKey(acctNumero: string, entryIndex: number) {
  return `${acctNumero}:${entryIndex}`;
}

interface Props {
  data: GrandLivre;
  xref: CrossReference | null;
  navigateTo: { ref: GlRef; seq: number } | null;
  onNavigateToRgd: (ref: RgdRef) => void;
}

function findCounterEntryIndex(
  data: GrandLivre,
  targetNumero: string,
  sourceNumero: string,
  sourceEntry: { date: string | null; debit: number | null; credit: number | null }
): number | null {
  const acct = data.accounts.find((a) => a.numero === targetNumero);
  if (!acct) return null;
  const idx = acct.entries.findIndex((e) => {
    if (e.date !== sourceEntry.date) return false;
    if (e.contre_partie === sourceNumero) return true;
    const eps = 0.005;
    const debitFlip = sourceEntry.debit != null && e.credit != null && Math.abs(sourceEntry.debit - e.credit) < eps;
    const creditFlip = sourceEntry.credit != null && e.debit != null && Math.abs(sourceEntry.credit - e.debit) < eps;
    return debitFlip || creditFlip;
  });
  return idx >= 0 ? idx : null;
}

export function LedgerView({ data, xref, navigateTo, onNavigateToRgd }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [highlightId, setHighlightId] = useState<string | null>(null);

  function toggle(numero: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(numero) ? next.delete(numero) : next.add(numero);
      return next;
    });
  }

  function expandAll() {
    setExpanded(new Set(data.accounts.map((a) => a.numero)));
  }

  function collapseAll() {
    setExpanded(new Set());
  }

  function navigateToEntry(acctNumero: string, entryIndex: number | null) {
    setExpanded((prev) => new Set([...prev, acctNumero]));
    const id = entryIndex != null ? `gl-${acctNumero}-${entryIndex}` : `gl-acct-${acctNumero}`;
    if (entryIndex != null) setHighlightId(id);
    setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "center" }), 60);
    if (entryIndex != null) setTimeout(() => setHighlightId(null), 1800);
  }

  useEffect(() => {
    if (!navigateTo) return;
    const { acctNumero, entryIndex } = navigateTo.ref;
    setExpanded((prev) => new Set([...prev, acctNumero]));
    const id = `gl-${acctNumero}-${entryIndex}`;
    setHighlightId(id);
    setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "center" }), 60);
    setTimeout(() => setHighlightId(null), 1800);
  }, [navigateTo?.seq]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      <h3>
        Grand Livre — {data.periode.from} au {data.periode.to}
      </h3>
      <p style={{ color: "#64748b" }}>
        {data.accounts.length} comptes |
        Total débit : {formatNumber(data.total_debit)} |
        Total crédit : {formatNumber(data.total_credit)}
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
            <th style={{ padding: "0.5rem" }}>Compte</th>
            <th style={{ padding: "0.5rem" }}>Libellé</th>
            <th style={{ padding: "0.5rem", textAlign: "center" }}>Écritures</th>
            <th style={{ padding: "0.5rem", textAlign: "right" }}>Débit</th>
            <th style={{ padding: "0.5rem", textAlign: "right" }}>Crédit</th>
          </tr>
        </thead>
        <tbody>
          {data.accounts.map((acct) => {
            const isOpen = expanded.has(acct.numero);
            return (
              <>
                <tr
                  key={acct.numero}
                  id={`gl-acct-${acct.numero}`}
                  onClick={() => toggle(acct.numero)}
                  style={{
                    borderBottom: "1px solid #e2e8f0",
                    cursor: "pointer",
                    background: isOpen ? "#eff6ff" : "transparent",
                  }}
                >
                  <td style={{ padding: "0.5rem", color: "#94a3b8", fontSize: "0.7rem", userSelect: "none" }}>
                    {isOpen ? "▼" : "▶"}
                  </td>
                  <td style={{ padding: "0.5rem", fontFamily: "monospace" }}>{acct.numero}</td>
                  <td style={{ padding: "0.5rem" }}>{acct.label}</td>
                  <td style={{ padding: "0.5rem", textAlign: "center" }}>{acct.entries.length}</td>
                  <td style={{ padding: "0.5rem", textAlign: "right" }}>
                    {formatNumber(acct.total_debit + acct.cumul_debit)}
                  </td>
                  <td style={{ padding: "0.5rem", textAlign: "right" }}>
                    {formatNumber(acct.total_credit + acct.cumul_credit)}
                  </td>
                </tr>
                {isOpen && (
                  <tr key={`${acct.numero}-entries`}>
                    <td
                      colSpan={6}
                      style={{
                        padding: "0.5rem 0.5rem 0.75rem 2rem",
                        background: "#f8fafc",
                        borderBottom: "2px solid #cbd5e1",
                      }}
                    >
                      <div style={{ fontSize: "0.75rem", color: "#64748b", marginBottom: "0.25rem" }}>
                        {acct.entries.length} écritures
                      </div>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
                        <thead>
                          <tr style={{ background: "#e2e8f0", textAlign: "left" }}>
                            <th style={{ padding: "0.2rem 0.5rem" }}>Date</th>
                            <th style={{ padding: "0.2rem 0.5rem" }}>Journal</th>
                            <th style={{ padding: "0.2rem 0.5rem" }}>Libellé</th>
                            <th style={{ padding: "0.2rem 0.5rem" }}>Contre-partie</th>
                            <th style={{ padding: "0.2rem 0.5rem", textAlign: "right" }}>Débit</th>
                            <th style={{ padding: "0.2rem 0.5rem", textAlign: "right" }}>Crédit</th>
                            <th style={{ padding: "0.2rem 0.5rem", textAlign: "right" }}>Solde</th>
                            <th style={{ padding: "0.2rem 0.5rem" }}></th>
                          </tr>
                        </thead>
                        <tbody>
                          {acct.entries.map((e, i) => {
                            const id = `gl-${acct.numero}-${i}`;
                            const rgdRef = xref?.glToRgd[glKey(acct.numero, i)];
                            const isHighlighted = highlightId === id;
                            return (
                              <tr
                                key={i}
                                id={id}
                                style={{
                                  borderBottom: "1px solid #e2e8f0",
                                  background: isHighlighted ? "#fef08a" : "transparent",
                                  transition: "background 0.4s",
                                }}
                              >
                                <td style={{ padding: "0.2rem 0.5rem", whiteSpace: "nowrap" }}>{e.date}</td>
                                <td style={{ padding: "0.2rem 0.5rem" }}>{e.journal}</td>
                                <td style={{ padding: "0.2rem 0.5rem" }}>{e.libelle}</td>
                                <td style={{ padding: "0.2rem 0.5rem" }}>
                                  {e.contre_partie && data.accounts.some((a) => a.numero === e.contre_partie) ? (
                                    <span
                                      onClick={(ev) => {
                                        ev.stopPropagation();
                                        const idx = findCounterEntryIndex(data, e.contre_partie!, acct.numero, e);
                                        navigateToEntry(e.contre_partie!, idx);
                                      }}
                                      style={linkStyle}
                                    >
                                      {e.contre_partie}
                                    </span>
                                  ) : e.contre_partie}
                                </td>
                                <td style={{ padding: "0.2rem 0.5rem", textAlign: "right" }}>{formatNumber(e.debit)}</td>
                                <td style={{ padding: "0.2rem 0.5rem", textAlign: "right" }}>{formatNumber(e.credit)}</td>
                                <td style={{ padding: "0.2rem 0.5rem", textAlign: "right" }}>
                                  {formatNumber(e.solde_debiteur ?? e.solde_crediteur)}
                                </td>
                                <td style={{ padding: "0.2rem 0.5rem" }}>
                                  {rgdRef && (
                                    <span
                                      onClick={(ev) => { ev.stopPropagation(); onNavigateToRgd(rgdRef); }}
                                      title="Voir dans le RGD"
                                      style={linkStyle}
                                    >
                                      RGD ↗
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
    </div>
  );
}
