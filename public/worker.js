/**
 * Web Worker: runs Pyodide (Python in WASM) for all PDF parsing and cross-checking.
 * The main thread never executes Python — all computation happens here.
 *
 * Message protocol (main → worker):
 *   { type: "init" }
 *     → loads Pyodide, installs pdfminer.six, fetches all parser modules.
 *     ← { type: "ready" } on success, { type: "error", error } on failure.
 *
 *   { type: "parse", module: "grand_livre"|"rgd", pdfBytes: Uint8Array, requestId: number }
 *     → calls module.parse(bytes) in Python, returns JSON string.
 *     ← { type: "result", requestId, data: string } or { type: "error", requestId, error }.
 *     ← { type: "progress", requestId, current: number, total: number } during parsing.
 *
 *   { type: "crosscheck", glJson: string, rgdJson: string, requestId: number }
 *     → calls cross_check.match(gl, rgd) on already-parsed dicts (not raw bytes).
 *     ← { type: "result", requestId, data: string } or { type: "error", requestId, error }.
 *
 *   { type: "parse", module: "factures", pdfBytes: Uint8Array, requestId: number }
 *     → calls factures.parse(bytes), returns JSON string.
 *
 *   { type: "match_factures", rgdJson: string, facturesJson: string, requestId: number }
 *     → calls factures.match(rgd, factures) on already-parsed dicts.
 *     ← { type: "result", requestId, data: string } or { type: "error", requestId, error }.
 */
importScripts("https://cdn.jsdelivr.net/pyodide/v0.27.7/full/pyodide.js");

let pyodide = null;

async function init() {
  pyodide = await loadPyodide();
  await pyodide.loadPackage("micropip");
  await pyodide.runPythonAsync(`
import micropip
await micropip.install("pdfminer.six")
`);

  const base = self.location.href.replace(/worker\.js$/, "");

  for (const name of ["utils", "grand_livre", "rgd", "cross_check", "factures"]) {
    const resp = await fetch(`${base}parser/${name}.py`);
    const code = await resp.text();
    pyodide.globals.set("__module_code__", code);
    pyodide.globals.set("__module_name__", name);
    await pyodide.runPythonAsync(`
import sys, types
_code = __module_code__
_name = __module_name__
mod = types.ModuleType(_name)
exec(compile(_code, _name + '.py', 'exec'), mod.__dict__)
sys.modules[_name] = mod
del _code, _name
`);
  }

  self.postMessage({ type: "ready" });
}

async function parseFile(module, pdfBytes, requestId) {
  pyodide.globals.set("pdf_bytes", pdfBytes);
  const jsonStr = await pyodide.runPythonAsync(`
import json
import ${module}

result = ${module}.parse(bytes(pdf_bytes))
json.dumps(result, ensure_ascii=False)
`);

  self.postMessage({ type: "result", requestId, data: jsonStr });
}

async function crossCheck(glJson, rgdJson, requestId) {
  pyodide.globals.set("gl_json", glJson);
  pyodide.globals.set("rgd_json", rgdJson);
  const jsonStr = await pyodide.runPythonAsync(`
import json, cross_check
gl  = json.loads(gl_json)
rgd = json.loads(rgd_json)
json.dumps(cross_check.match(gl, rgd), ensure_ascii=False)
`);
  self.postMessage({ type: "result", requestId, data: jsonStr });
}


async function matchFactures(rgdJson, facturesJson, requestId) {
  pyodide.globals.set("rgd_json", rgdJson);
  pyodide.globals.set("factures_json", facturesJson);
  const jsonStr = await pyodide.runPythonAsync(`
import json, factures
rgd      = json.loads(rgd_json)
fact     = json.loads(factures_json)
json.dumps(factures.match(rgd, fact), ensure_ascii=False)
`);
  self.postMessage({ type: "result", requestId, data: jsonStr });
}

self.onmessage = async (e) => {
  const { type, module, pdfBytes, glJson, rgdJson, facturesJson, page, requestId } = e.data;
  if (type === "init") {
    try {
      await init();
    } catch (err) {
      self.postMessage({ type: "error", error: String(err) });
    }
  } else if (type === "parse") {
    try {
      await parseFile(module, pdfBytes, requestId);
    } catch (err) {
      self.postMessage({ type: "error", requestId, error: String(err) });
    }
  } else if (type === "crosscheck") {
    try {
      await crossCheck(glJson, rgdJson, requestId);
    } catch (err) {
      self.postMessage({ type: "error", requestId, error: String(err) });
    }
  } else if (type === "match_factures") {
    try {
      await matchFactures(rgdJson, facturesJson, requestId);
    } catch (err) {
      self.postMessage({ type: "error", requestId, error: String(err) });
    }
  }
};
