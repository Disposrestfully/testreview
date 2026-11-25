import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = resolve(root, "_site");

await rm(output, { recursive: true, force: true });
await mkdir(resolve(output, "data"), { recursive: true });
await mkdir(resolve(output, "assets", "questions"), { recursive: true });

for (const filename of ["index.html", "styles.css", "app.js"]) {
  await cp(resolve(root, filename), resolve(output, filename));
}

await cp(resolve(root, "data", "questions.json"), resolve(output, "data", "questions.json"));
await cp(resolve(root, "assets", "questions"), resolve(output, "assets", "questions"), {
  recursive: true,
});
await writeFile(resolve(output, ".nojekyll"), "", "utf8");

console.log(`GitHub Pages artifact built at ${output}`);
