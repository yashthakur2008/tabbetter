import fs from "node:fs";
const source = fs
  .readFileSync("src/data.mjs", "utf8")
  .replaceAll("export function ", "function ")
  .replaceAll("export const ", "const ");
const rankingsSource = fs
  .readFileSync("src/rankings/corpus.mjs", "utf8")
  .replaceAll("export function ", "function ")
  .replaceAll("export const ", "const ");
const discoverySource = fs.readFileSync("src/discovery.mjs", "utf8")
  .replaceAll("export function ", "function ")
  .replaceAll("export const ", "const ");
const discoveryApiSource = fs.readFileSync("src/discovery-api.mjs", "utf8")
  .replace(/^import .*;\n/gm, "")
  .replaceAll("export function ", "function ");
const discoveryScript = fs.existsSync("web/discovery.js") ? fs.readFileSync("web/discovery.js", "utf8") : "";
const discoveryStyles = fs.existsSync("web/discovery.css") ? fs.readFileSync("web/discovery.css", "utf8") : "";
const workspaceScript = fs.readFileSync("web/workspace.js", "utf8");
const tutorialScript = fs.readFileSync("web/tutorial.js", "utf8");
const workspaceStyles = fs.readFileSync("web/workspace.css", "utf8");
// Normalize legacy fixed text sizes to rem without changing default geometry.
// Root text-size preferences then scale tables, dialogs and all existing pages.
function scalableText(css) {
  return css.replace(/font-size\s*:[^;}]+/g, declaration =>
    declaration.replace(/(\d*\.?\d+)px\b/g, (_, pixels) => Number(pixels) / 16 + "rem"));
}
const styles = fs.readFileSync("web/styles.css", "utf8");
const script = fs.readFileSync("web/app.js", "utf8");
if (
  [script, discoverySource, discoveryScript, workspaceScript, tutorialScript].some(s => /<\/script/i.test(s)) ||
  [styles, discoveryStyles, workspaceStyles].some(s => /<\/style/i.test(s))
)
  throw Error("Unsafe closing tag in embedded asset");
const page = fs
  .readFileSync("web/index.html", "utf8")
  .replace(
    /<link\s+rel="stylesheet"\s+href="\/styles.css"\s*\/?\s*>/,
    () => "<style>" + scalableText(styles + "\n" + discoveryStyles) + "\n" + workspaceStyles + "</style>",
  )
  .replace(
    /<script\s+src="\/app.js"\s+defer><\/script>/,
    // Keep app.js in its own script so existing VM extraction markers survive.
    () => "<script>" + discoverySource + "</script><script>" + script + "</script>" +
      (discoveryScript ? "<script>" + discoveryScript + "</script>" : "") +
      "<script>" + workspaceScript + "</script><script>" + tutorialScript + "\ninitWorkspace();</script>",
  );
if (page.includes('href="/styles.css"') || page.includes('src="/app.js"'))
  throw Error("Asset embedding failed");
const logo = fs.readFileSync("assets/logo.png").toString("base64");
// The rankings corpus is embedded only when it has been imported locally and
// its redistribution is cleared. Its absence is a supported build state.
const corpusPath = "build/rankings-corpus.json";
const corpus = fs.existsSync(corpusPath)
  ? fs.readFileSync(corpusPath, "utf8")
  : "null";
fs.mkdirSync("worker", { recursive: true });
fs.writeFileSync(
  "worker/index.js",
  "const page = " +
    JSON.stringify(page) +
    ";\nconst logo = " +
    JSON.stringify(logo) +
    ";\nconst rankingsCorpus = " +
    corpus +
    ";\n" +
    source +
    "\n" +
    discoverySource +
    "\n" +
    discoveryApiSource +
    "\n" +
    rankingsSource +
    "\n" +
    fs.readFileSync("src/server.mjs", "utf8"),
);
