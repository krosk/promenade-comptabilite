import { useState } from "react";
import type { GrandLivre, Account } from "../model/types";

function formatNumber(n: number | null): string {
  if (n === null || n === undefined) return "";
  return n.toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function AccountDetail({ account }: { account: Account }) {
  return (
    <div style={{ marginTop: "1rem" }}>
      <h4 style={{ margin: "0 0 0.5rem" }}>
        {account.numero} — {account.label}
      </h4>
      <p style={{ fontSize: "0.875rem", color: "#64748b" }}>
        {account.entries.length} écritures | Débit : {formatNumber(account.total_debit)} |
        Crédit : {formatNumber(account.total_credit)}
      </p>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
          <thead>
            <tr style={{ background: "#f1f5f9", textAlign: "left" }}>
              <th style={{ padding: "0.25rem 0.5rem" }}>Date</th>
              <th style={{ padding: "0.25rem 0.5rem" }}>Journal</th>
              <th style={{ padding: "0.25rem 0.5rem" }}>Libellé</th>
              <th style={{ padding: "0.25rem 0.5rem" }}>Contre-partie</th>
              <th style={{ padding: "0.25rem 0.5rem", textAlign: "right" }}>Débit</th>
              <th style={{ padding: "0.25rem 0.5rem", textAlign: "right" }}>Crédit</th>
              <th style={{ padding: "0.25rem 0.5rem", textAlign: "right" }}>Solde</th>
            </tr>
          </thead>
          <tbody>
            {account.entries.map((e, i) => (
              <tr key={i} style={{ borderBottom: "1px solid #e2e8f0" }}>
                <td style={{ padding: "0.25rem 0.5rem", whiteSpace: "nowrap" }}>{e.date}</td>
                <td style={{ padding: "0.25rem 0.5rem" }}>{e.journal}</td>
                <td style={{ padding: "0.25rem 0.5rem" }}>{e.libelle}</td>
                <td style={{ padding: "0.25rem 0.5rem" }}>{e.contre_partie}</td>
                <td style={{ padding: "0.25rem 0.5rem", textAlign: "right" }}>
                  {formatNumber(e.debit)}
                </td>
                <td style={{ padding: "0.25rem 0.5rem", textAlign: "right" }}>
                  {formatNumber(e.credit)}
                </td>
                <td style={{ padding: "0.25rem 0.5rem", textAlign: "right" }}>
                  {formatNumber(e.solde_debiteur ?? e.solde_crediteur)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function LedgerView({ data }: { data: GrandLivre }) {
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);

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

      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
        <thead>
          <tr style={{ background: "#f1f5f9", textAlign: "left" }}>
            <th style={{ padding: "0.5rem" }}>Compte</th>
            <th style={{ padding: "0.5rem" }}>Libellé</th>
            <th style={{ padding: "0.5rem", textAlign: "center" }}>Écritures</th>
            <th style={{ padding: "0.5rem", textAlign: "right" }}>Débit</th>
            <th style={{ padding: "0.5rem", textAlign: "right" }}>Crédit</th>
          </tr>
        </thead>
        <tbody>
          {data.accounts.map((acct) => (
            <tr
              key={acct.numero}
              onClick={() =>
                setSelectedAccount(
                  selectedAccount === acct.numero ? null : acct.numero
                )
              }
              style={{
                borderBottom: "1px solid #e2e8f0",
                cursor: "pointer",
                background:
                  selectedAccount === acct.numero ? "#eff6ff" : "transparent",
              }}
            >
              <td style={{ padding: "0.5rem", fontFamily: "monospace" }}>{acct.numero}</td>
              <td style={{ padding: "0.5rem" }}>{acct.label}</td>
              <td style={{ padding: "0.5rem", textAlign: "center" }}>
                {acct.entries.length}
              </td>
              <td style={{ padding: "0.5rem", textAlign: "right" }}>
                {formatNumber(acct.total_debit + acct.cumul_debit)}
              </td>
              <td style={{ padding: "0.5rem", textAlign: "right" }}>
                {formatNumber(acct.total_credit + acct.cumul_credit)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {selectedAccount && (
        <AccountDetail
          account={data.accounts.find((a) => a.numero === selectedAccount)!}
        />
      )}
    </div>
  );
}
