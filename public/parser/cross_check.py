"""
Cross-reference matching between Grand Livre and RGD.

match(gl, rgd) resolves 1:1 correspondences: an RGD entry and a GL entry
in the same account, on the same date, with the same montant_ttc (≈ debit).

Match criteria (all three must hold):
  - Same compte: RgdAccount.numero == Account.numero
  - Same date: exact string match (DD/MM/YYYY)
  - Amount: positive montant_ttc → |montant_ttc - gl_entry.debit| < EPSILON (0.005 €)
            negative montant_ttc → |-montant_ttc - gl_entry.credit| < EPSILON (reimbursements)

Matching strategy (two passes):
  Pass 2 — strict 1:1: each side has exactly one counterpart.
  Pass 3 — balanced N×N: N RGD entries share the same N GL candidates and vice
    versa (legitimate duplicates on the same date/amount). Paired by sorted key
    order. Unbalanced groups (M RGD → N GL where M ≠ N) are excluded.

Keys used in the result dicts:
  rgd side  →  "{cle_index}:{acct_numero}:{entry_index}"
  gl  side  →  "{acct_numero}:{entry_index}"
"""


EPSILON = 0.005  # euro tolerance for float comparison


def _amounts_match(montant_ttc, debit):
    if montant_ttc is None or debit is None:
        return False
    return abs(montant_ttc - debit) < EPSILON


def _rgd_key(cle_index: int, acct_numero: str, entry_index: int) -> str:
    return f"{cle_index}:{acct_numero}:{entry_index}"


def _gl_key(acct_numero: str, entry_index: int) -> str:
    return f"{acct_numero}:{entry_index}"


def match(gl: dict, rgd: dict) -> dict:
    """
    Return the 1:1 matched pairs between RGD entries and GL entries.

    Args:
        gl:  result of grand_livre.parse()
        rgd: result of rgd.parse()

    Returns:
        {
          "rgd_to_gl": { rgd_key: {"acct_numero": str, "entry_index": int}, ... },
          "gl_to_rgd": { gl_key:  {"cle_index": int, "acct_numero": str, "entry_index": int}, ... },
        }
    """
    # Index GL entries by account numero for fast lookup
    gl_by_account: dict[str, list] = {}
    for acct in gl.get("accounts", []):
        gl_by_account[acct["numero"]] = acct.get("entries", [])

    # Pass 1: collect candidates
    # rgd_key → list of gl_keys that match
    rgd_candidates: dict[str, list[str]] = {}
    # gl_key  → list of rgd_keys that match
    gl_candidates: dict[str, list[str]] = {}

    for ci, cle in enumerate(rgd.get("cles", [])):
        for acct in cle.get("accounts", []):
            gl_entries = gl_by_account.get(acct["numero"])
            if not gl_entries:
                continue

            for ei, re in enumerate(acct.get("entries", [])):
                rk = _rgd_key(ci, acct["numero"], ei)

                for gi, ge in enumerate(gl_entries):
                    if ge.get("date") != re.get("date"):
                        continue
                    montant = re.get("montant_ttc")
                    if montant is None:
                        continue
                    if montant >= 0:
                        if not _amounts_match(montant, ge.get("debit")):
                            continue
                    else:
                        if not _amounts_match(-montant, ge.get("credit")):
                            continue

                    gk = _gl_key(acct["numero"], gi)
                    rgd_candidates.setdefault(rk, []).append(gk)
                    gl_candidates.setdefault(gk, []).append(rk)

    # Pass 2: keep only true 1:1 pairs
    rgd_to_gl: dict[str, dict] = {}
    gl_to_rgd: dict[str, dict] = {}

    for rk, gks in rgd_candidates.items():
        if len(gks) != 1:
            continue
        gk = gks[0]
        if len(gl_candidates.get(gk, [])) != 1:
            continue

        # Parse keys
        ci_str, acct_numero, ei_str = rk.split(":")
        gi_str = gk.split(":")[1]

        rgd_to_gl[rk] = {
            "acct_numero": acct_numero,
            "entry_index": int(gi_str),
        }
        gl_to_rgd[gk] = {
            "cle_index": int(ci_str),
            "acct_numero": acct_numero,
            "entry_index": int(ei_str),
        }

    # Pass 3: balanced N×N groups (legitimate duplicate entries)
    # Group unmatched RGD entries by their frozenset of GL candidates.
    from collections import defaultdict
    rgd_groups: dict[frozenset, list[str]] = defaultdict(list)
    for rk, gks in rgd_candidates.items():
        if rk not in rgd_to_gl:
            rgd_groups[frozenset(gks)].append(rk)

    for gk_set, rks in rgd_groups.items():
        if len(rks) != len(gk_set):
            continue  # unbalanced — skip
        # GL side must map back to exactly this RGD group
        rks_set = frozenset(rks)
        if not all(frozenset(gl_candidates.get(gk, [])) == rks_set for gk in gk_set):
            continue
        # Pair by sorted order — deterministic, arbitrary but consistent
        for rk, gk in zip(sorted(rks), sorted(gk_set)):
            ci_str, acct_numero, ei_str = rk.split(":")
            gi_str = gk.split(":")[1]
            rgd_to_gl[rk] = {"acct_numero": acct_numero, "entry_index": int(gi_str)}
            gl_to_rgd[gk] = {"cle_index": int(ci_str), "acct_numero": acct_numero, "entry_index": int(ei_str)}

    # Pass 4: propagate RGD links to contre-partie entries.
    # Group by (src_acct, cp_acct, date, debit, credit) so N:N duplicate groups
    # are handled together — same balanced pairing strategy as Pass 3.
    cp_groups: dict[tuple, list[tuple]] = defaultdict(list)
    for gk, rgd_ref in gl_to_rgd.items():
        acct_numero, ei_str = gk.split(":")
        entries = gl_by_account.get(acct_numero, [])
        if not entries:
            continue
        entry = entries[int(ei_str)]
        cp_numero = entry.get("contre_partie")
        if not cp_numero:
            continue
        sig = (acct_numero, cp_numero, entry.get("date"), entry.get("debit"), entry.get("credit"))
        cp_groups[sig].append((gk, rgd_ref))

    for (acct_numero, cp_numero, date, debit, credit), sources in cp_groups.items():
        cp_entries = gl_by_account.get(cp_numero)
        if not cp_entries:
            continue

        cp_candidates = []
        for j, cpe in enumerate(cp_entries):
            if cpe.get("date") != date:
                continue
            cp_gk = _gl_key(cp_numero, j)
            if cp_gk in gl_to_rgd:
                continue
            if cpe.get("contre_partie") == acct_numero:
                cp_candidates.append(cp_gk)
                continue
            cp_debit = cpe.get("debit")
            cp_credit = cpe.get("credit")
            debit_flip = debit is not None and cp_credit is not None and abs(debit - cp_credit) < EPSILON
            credit_flip = credit is not None and cp_debit is not None and abs(credit - cp_debit) < EPSILON
            if debit_flip or credit_flip:
                cp_candidates.append(cp_gk)

        if len(sources) != len(cp_candidates):
            continue  # unbalanced — skip

        for (gk, rgd_ref), cp_gk in zip(
            sorted(sources, key=lambda x: x[0]), sorted(cp_candidates)
        ):
            gl_to_rgd[cp_gk] = rgd_ref

    return {"rgd_to_gl": rgd_to_gl, "gl_to_rgd": gl_to_rgd}
