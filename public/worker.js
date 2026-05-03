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

  for (const name of ["utils", "grand_livre", "rgd"]) {
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

self.onmessage = async (e) => {
  const { type, module, pdfBytes, requestId } = e.data;
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
  }
};
