import { useState } from "react";
import type { Rgd, RgdCle } from "../model/types";

function formatNumber(n: number | null): string {
  if (n === null || n === undefined) return "";
  return n.toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function CleDetail({ cle }: { cle: RgdCle }) {
  const [expandedAccount, setExpandedAccount] = useState<string | null>(null);

  return (
    <div style={{ marginTop: "1rem" }}>
      <h4 style={{ margin: "0 0 0.5rem" }}>
        {cle.nom} (clé {cle.numero}) — Total : {formatNumber(cle.total)}
      </h4>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
        <thead>
          <tr style={{ background: "#f1f5f9", textAlign: "left" }}>
            <th style={{ padding: "0.25rem 0.5rem" }}>Compte</th>
            <th style={{ padding: "0.25rem 0.5rem" }}>Libellé</th>
            <th style={{ padding: "0.25rem 0.5rem", textAlign: "center" }}>Lignes</th>
            <th style={{ padding: "0.25rem 0.5rem", textAlign: "right" }}>Sous-total TTC</th>
            <th style={{ padding: "0.25rem 0.5rem", textAlign: "right" }}>TVA</th>
            <th style={{ padding: "0.25rem 0.5rem", textAlign: "right" }}>Ch. locatives</th>
          </tr>
        </thead>
        <tbody>
          {cle.accounts.map((acct) => (
            <tr
              key={acct.numero}
              onClick={() =>
                setExpandedAccount(
                  expandedAccount === acct.numero ? null : acct.numero
                )
              }
              style={{
                borderBottom: "1px solid #e2e8f0",
                cursor: "pointer",
                background:
                  expandedAccount === acct.numero ? "#eff6ff" : "transparent",
              }}
            >
              <td style={{ padding: "0.25rem 0.5rem", fontFamily: "monospace" }}>
                {acct.numero}
              </td>
              <td style={{ padding: "0.25rem 0.5rem" }}>{acct.label}</td>
              <td style={{ padding: "0.25rem 0.5rem", textAlign: "center" }}>
                {acct.entries.length}
              </td>
              <td style={{ padding: "0.25rem 0.5rem", textAlign: "right" }}>
                {formatNumber(acct.sous_total)}
              </td>
              <td style={{ padding: "0.25rem 0.5rem", textAlign: "right" }}>
                {formatNumber(acct.sous_total_tva)}
              </td>
              <td style={{ padding: "0.25rem 0.5rem", textAlign: "right" }}>
                {formatNumber(acct.sous_total_charges_locatives)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {expandedAccount && (() => {
        const acct = cle.accounts.find((a) => a.numero === expandedAccount);
        if (!acct) return null;
        return (
          <div style={{ marginTop: "0.5rem", marginLeft: "1rem" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.75rem" }}>
              <thead>
                <tr style={{ background: "#f8fafc", textAlign: "left" }}>
                  <th style={{ padding: "0.25rem 0.5rem" }}>Date</th>
                  <th style={{ padding: "0.25rem 0.5rem" }}>Libellé</th>
                  <th style={{ padding: "0.25rem 0.5rem" }}>Fournisseur</th>
                  <th style={{ padding: "0.25rem 0.5rem", textAlign: "right" }}>TTC</th>
                  <th style={{ padding: "0.25rem 0.5rem", textAlign: "right" }}>TVA</th>
                  <th style={{ padding: "0.25rem 0.5rem", textAlign: "right" }}>Ch. loc.</th>
                </tr>
              </thead>
              <tbody>
                {acct.entries.map((e, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #e2e8f0" }}>
                    <td style={{ padding: "0.25rem 0.5rem", whiteSpace: "nowrap" }}>
                      {e.date}
                    </td>
                    <td style={{ padding: "0.25rem 0.5rem" }}>{e.libelle}</td>
                    <td style={{ padding: "0.25rem 0.5rem" }}>{e.fournisseur}</td>
                    <td style={{ padding: "0.25rem 0.5rem", textAlign: "right" }}>
                      {formatNumber(e.montant_ttc)}
                    </td>
                    <td style={{ padding: "0.25rem 0.5rem", textAlign: "right" }}>
                      {formatNumber(e.tva)}
                    </td>
                    <td style={{ padding: "0.25rem 0.5rem", textAlign: "right" }}>
                      {formatNumber(e.charges_locatives)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })()}
    </div>
  );
}

export function RgdView({ data }: { data: Rgd }) {
  const [selectedCle, setSelectedCle] = useState<string | null>(null);

  return (
    <div>
      <h3>
        Relevé Général des Dépenses — {data.periode.from} au {data.periode.to}
      </h3>
      <p style={{ color: "#64748b" }}>
        {data.cles.length} clés de répartition |
        Total dépenses : {formatNumber(data.total_depenses)}
      </p>

      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
        <thead>
          <tr style={{ background: "#f1f5f9", textAlign: "left" }}>
            <th style={{ padding: "0.5rem" }}>Clé</th>
            <th style={{ padding: "0.5rem" }}>Nom</th>
            <th style={{ padding: "0.5rem", textAlign: "center" }}>Comptes</th>
            <th style={{ padding: "0.5rem", textAlign: "right" }}>Total TTC</th>
          </tr>
        </thead>
        <tbody>
          {data.cles.map((cle) => (
            <tr
              key={cle.numero}
              onClick={() =>
                setSelectedCle(
                  selectedCle === cle.nom ? null : cle.nom
                )
              }
              style={{
                borderBottom: "1px solid #e2e8f0",
                cursor: "pointer",
                background:
                  selectedCle === cle.nom ? "#eff6ff" : "transparent",
              }}
            >
              <td style={{ padding: "0.5rem", fontFamily: "monospace" }}>{cle.numero}</td>
              <td style={{ padding: "0.5rem" }}>{cle.nom}</td>
              <td style={{ padding: "0.5rem", textAlign: "center" }}>
                {cle.accounts.length}
              </td>
              <td style={{ padding: "0.5rem", textAlign: "right" }}>
                {formatNumber(cle.total)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {selectedCle && (
        <CleDetail cle={data.cles.find((c) => c.nom === selectedCle)!} />
      )}
    </div>
  );
}
