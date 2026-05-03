export interface GrandLivreEntry {
  journal: string | null;
  date: string | null;
  contre_partie: string | null;
  libelle: string | null;
  numero_piece: string | null;
  debit: number | null;
  credit: number | null;
  solde_debiteur: number | null;
  solde_crediteur: number | null;
}

export interface Account {
  numero: string;
  label: string;
  classe: string;
  cumul_debit: number;
  cumul_credit: number;
  entries: GrandLivreEntry[];
  total_debit: number;
  total_credit: number;
  total_entry_count: number;
}

export interface GrandLivre {
  periode: { from: string; to: string };
  accounts: Account[];
  total_debit: number;
  total_credit: number;
}

export interface RgdEntry {
  libelle: string | null;
  montant_ttc: number | null;
  charges_locatives: number | null;
  tva: number | null;
  date: string | null;
  fournisseur: string | null;
}

export interface RgdAccount {
  numero: string;
  label: string;
  entries: RgdEntry[];
  sous_total: number;
  sous_total_tva: number;
  sous_total_charges_locatives: number;
}

export interface RgdCle {
  nom: string;
  numero: number;
  accounts: RgdAccount[];
  total: number;
}

export interface Rgd {
  periode: { from: string; to: string };
  cles: RgdCle[];
  total_depenses: number;
}

export interface GlRef {
  acctNumero: string;
  entryIndex: number;
}

export interface RgdRef {
  cleIndex: number;
  acctNumero: string;
  entryIndex: number;
}

export interface CrossReference {
  rgdToGl: Record<string, GlRef>;
  glToRgd: Record<string, RgdRef>;
}
