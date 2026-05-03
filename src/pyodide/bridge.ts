import type { GrandLivre, Rgd, CrossReference } from "../model/types";

type ProgressCallback = (current: number, total: number) => void;

let worker: Worker | null = null;
let readyPromise: Promise<void> | null = null;
let requestCounter = 0;

const pendingRequests = new Map<
  number,
  {
    resolve: (data: string) => void;
    reject: (err: Error) => void;
    onProgress?: ProgressCallback;
  }
>();

let onInitError: ((err: string) => void) | null = null;

function getWorker(): Worker {
  if (worker) return worker;

  const base = import.meta.env.BASE_URL;
  worker = new Worker(`${base}worker.js`);

  worker.onmessage = (e) => {
    const msg = e.data;
    if (msg.type === "ready") {
      return;
    }
    if (msg.type === "error" && msg.requestId == null) {
      if (onInitError) onInitError(msg.error);
      return;
    }
    if (msg.type === "progress") {
      const req = pendingRequests.get(msg.requestId);
      if (req?.onProgress) req.onProgress(msg.current, msg.total);
      return;
    }
    if (msg.type === "result") {
      const req = pendingRequests.get(msg.requestId);
      if (req) {
        pendingRequests.delete(msg.requestId);
        req.resolve(msg.data);
      }
      return;
    }
    if (msg.type === "error" && msg.requestId != null) {
      const req = pendingRequests.get(msg.requestId);
      if (req) {
        pendingRequests.delete(msg.requestId);
        req.reject(new Error(msg.error));
      }
      return;
    }
  };

  return worker;
}

/** Initialises Pyodide and loads all parser modules. Safe to call multiple times — returns the same promise. */
export function initPyodide(
  onProgress?: (status: string) => void
): Promise<void> {
  if (readyPromise) return readyPromise;

  readyPromise = new Promise<void>((resolve, reject) => {
    const w = getWorker();
    onInitError = (err) => reject(new Error(err));

    const handler = (e: MessageEvent) => {
      if (e.data.type === "ready") {
        w.removeEventListener("message", handler);
        resolve();
      } else if (e.data.type === "error" && e.data.requestId == null) {
        w.removeEventListener("message", handler);
        reject(new Error(e.data.error));
      }
    };
    w.addEventListener("message", handler);

    if (onProgress) onProgress("Chargement de Python...");
    w.postMessage({ type: "init" });
  });

  return readyPromise;
}

function parseFile(
  module: string,
  pdfBytes: Uint8Array,
  onProgress?: ProgressCallback
): Promise<string> {
  return new Promise((resolve, reject) => {
    const requestId = ++requestCounter;
    pendingRequests.set(requestId, { resolve, reject, onProgress });
    getWorker().postMessage(
      { type: "parse", module, pdfBytes, requestId },
      [pdfBytes.buffer]
    );
  });
}

/** Parses a Grand Livre PDF. Transfers pdfBytes ownership to the worker (zero-copy). */
export async function parseGrandLivre(
  pdfBytes: Uint8Array,
  onProgress?: ProgressCallback
): Promise<GrandLivre> {
  await initPyodide();
  const json = await parseFile("grand_livre", pdfBytes, onProgress);
  return JSON.parse(json);
}

/** Parses an RGD PDF. Transfers pdfBytes ownership to the worker (zero-copy). */
export async function parseRgd(
  pdfBytes: Uint8Array,
  onProgress?: ProgressCallback
): Promise<Rgd> {
  await initPyodide();
  const json = await parseFile("rgd", pdfBytes, onProgress);
  return JSON.parse(json);
}

/**
 * Computes 1:1 cross-references between already-parsed GL and RGD dicts.
 * Passes serialised JSON to Python — does not re-parse any PDF.
 * Returns only confirmed 1:1 pairs; multi-entry splits are excluded.
 */
export async function crossCheck(
  gl: GrandLivre,
  rgd: Rgd
): Promise<CrossReference> {
  await initPyodide();
  const json = await new Promise<string>((resolve, reject) => {
    const requestId = ++requestCounter;
    pendingRequests.set(requestId, { resolve, reject });
    getWorker().postMessage({
      type: "crosscheck",
      glJson: JSON.stringify(gl),
      rgdJson: JSON.stringify(rgd),
      requestId,
    });
  });
  const raw = JSON.parse(json) as {
    rgd_to_gl: Record<string, { acct_numero: string; entry_index: number }>;
    gl_to_rgd: Record<string, { cle_index: number; acct_numero: string; entry_index: number }>;
  };
  const rgdToGl: CrossReference["rgdToGl"] = {};
  const glToRgd: CrossReference["glToRgd"] = {};
  for (const [k, v] of Object.entries(raw.rgd_to_gl)) {
    rgdToGl[k] = { acctNumero: v.acct_numero, entryIndex: v.entry_index };
  }
  for (const [k, v] of Object.entries(raw.gl_to_rgd)) {
    glToRgd[k] = { cleIndex: v.cle_index, acctNumero: v.acct_numero, entryIndex: v.entry_index };
  }
  return { rgdToGl, glToRgd };
}
