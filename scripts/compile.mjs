import fs from "node:fs";
const source = fs
  .readFileSync("src/data.mjs", "utf8")
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
fs.mkdirSync("worker", { recursive: true });
fs.writeFileSync(
  "worker/index.js",
  "const page = " +
    JSON.stringify(page) +
    ";\nconst logo = " +
    JSON.stringify(logo) +
    ";\n" +
    source +
    "\n" +
    fs.readFileSync("src/server.mjs", "utf8"),
);
