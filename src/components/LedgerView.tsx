import { useState } from "react";
import type { GrandLivre } from "../model/types";

function formatNumber(n: number | null): string {
  if (n === null || n === undefined) return "";
  return n.toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function LedgerView({ data }: { data: GrandLivre }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

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
                          </tr>
                        </thead>
                        <tbody>
                          {acct.entries.map((e, i) => (
                            <tr key={i} style={{ borderBottom: "1px solid #e2e8f0" }}>
                              <td style={{ padding: "0.2rem 0.5rem", whiteSpace: "nowrap" }}>{e.date}</td>
                              <td style={{ padding: "0.2rem 0.5rem" }}>{e.journal}</td>
                              <td style={{ padding: "0.2rem 0.5rem" }}>{e.libelle}</td>
                              <td style={{ padding: "0.2rem 0.5rem" }}>{e.contre_partie}</td>
                              <td style={{ padding: "0.2rem 0.5rem", textAlign: "right" }}>{formatNumber(e.debit)}</td>
                              <td style={{ padding: "0.2rem 0.5rem", textAlign: "right" }}>{formatNumber(e.credit)}</td>
                              <td style={{ padding: "0.2rem 0.5rem", textAlign: "right" }}>
                                {formatNumber(e.solde_debiteur ?? e.solde_crediteur)}
                              </td>
                            </tr>
                          ))}
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
