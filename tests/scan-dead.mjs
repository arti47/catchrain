// Dead-data scan: the mechanical pass that finds rules extracted and never
// called. Two questions — which exports does nothing read, and which named
// imports does a file never use?
import { readFileSync, readdirSync } from "node:fs";

const files = ["data.js", ...readdirSync("src").filter((f) => f.endsWith(".js")).map((f) => `src/${f}`)];
// Harnesses consume the engine too; an export only they call is still reachable.
const consumers = [...files, ...readdirSync("tests").filter((f) => f.endsWith(".mjs")).map((f) => `tests/${f}`)];
const src = new Map(files.map((f) => [f, readFileSync(f, "utf8")]));
const all = new Map(consumers.map((f) => [f, readFileSync(f, "utf8")]));

const EXPORT_DECL = /^export\s+(?:async\s+)?(?:const|let|function|class)\s+([A-Za-z0-9_$]+)/gm;

function exportsOf(text) {
  const names = new Set();
  for (const m of text.matchAll(EXPORT_DECL)) names.add(m[1]);
  for (const m of text.matchAll(/^export\s*\{([^}]+)\}/gm))
    for (const part of m[1].split(",")) names.add(part.split(" as ").pop().trim());
  return names;
}

function importsOf(text) {
  const named = [], namespaces = [];
  for (const m of text.matchAll(/import\s+([^;]+?)\s+from\s+["']([^"']+)["']/g)) {
    const clause = m[1].trim(), from = m[2];
    const ns = clause.match(/\*\s+as\s+([A-Za-z0-9_$]+)/);
    if (ns) namespaces.push({ alias: ns[1], from });
    const braces = clause.match(/\{([^}]*)\}/);
    if (braces) for (const part of braces[1].split(",").map((x) => x.trim()).filter(Boolean))
      named.push({ name: part.split(" as ").pop().trim(), original: part.split(" as ")[0].trim(), from });
  }
  return { named, namespaces };
}

const resolve = (from, spec) => from.startsWith("tests/")
  ? spec.replace(/^\.\.\//, "").replace(/^\.\//, "tests/")
  : spec.replace(/^\.\.\//, "").replace(/^\.\//, "src/");

// $ is not a word character, so \b cannot bound it: use identifier lookarounds.
const word = (name) => new RegExp(`(?<![A-Za-z0-9_$])${name.replace(/\$/g, "\\$")}(?![A-Za-z0-9_$])`, "g");
const findings = [];
const used = new Map(files.map((f) => [f, new Set()]));

for (const [file, text] of all) {
  const { named, namespaces } = importsOf(text);
  const body = text.replace(/^import[^;]+;$/gm, "");
  for (const imp of named) {
    if (!word(imp.name).test(body)) findings.push(`${file}: imports ${imp.name} from ${imp.from} and never uses it`);
    const target = resolve(file, imp.from);
    if (used.has(target)) used.get(target).add(imp.original);
  }
  for (const ns of namespaces) {
    const target = resolve(file, ns.from);
    if (!used.has(target)) continue;
    for (const m of body.matchAll(new RegExp(`(?<![A-Za-z0-9_$])${ns.alias}\\.([A-Za-z0-9_$]+)`, "g"))) used.get(target).add(m[1]);
  }
}

for (const [file, text] of src) {
  if (file === "src/main.js") continue; // the entry point is loaded by the page, not imported
  for (const name of exportsOf(text)) {
    if (used.get(file).has(name)) continue;
    // Read inside its own module is not dead data, only an over-wide export.
    const hits = (text.match(word(name)) || []).length;
    if (hits > 1) continue;
    findings.push(`${file}: exports ${name} — nothing reads it`);
  }
}

if (findings.length) { console.log("findings:"); for (const f of findings) console.log("  " + f); }
else console.log("dead-data scan clean");
process.exit(findings.length ? 1 : 0);
