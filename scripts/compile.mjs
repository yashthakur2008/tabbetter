import fs from "node:fs";
const source = fs
  .readFileSync("src/data.mjs", "utf8")
  .replaceAll("export function ", "function ")
  .replaceAll("export const ", "const ");
const rankingsSource = fs
  .readFileSync("src/rankings/corpus.mjs", "utf8")
  .replaceAll("export function ", "function ")
  .replaceAll("export const ", "const ");
const styles = fs.readFileSync("web/styles.css", "utf8");
const script = fs.readFileSync("web/app.js", "utf8");
if (/<\/script/i.test(script) || /<\/style/i.test(styles))
  throw Error("Unsafe closing tag in embedded asset");
const page = fs
  .readFileSync("web/index.html", "utf8")
  .replace(
    /<link\s+rel="stylesheet"\s+href="\/styles.css"\s*\/?\s*>/,
    () => "<style>" + styles + "</style>",
  )
  .replace(
    /<script\s+src="\/app.js"\s+defer><\/script>/,
    () => "<script>" + script + "</script>",
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
    rankingsSource +
    "\n" +
    fs.readFileSync("src/server.mjs", "utf8"),
);
