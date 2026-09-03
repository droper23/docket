import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { COURSES } from "../src/courses.config.js";
import { STORE_PATH } from "../src/sync.js";
import type { DataStore } from "../src/types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = 4173;

const server = createServer((req, res) => {
  if (req.url === "/" || req.url === "/index.html") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(readFileSync(join(__dirname, "index.html"), "utf-8"));
    return;
  }

  if (req.url === "/api/data") {
    const store: DataStore = existsSync(STORE_PATH)
      ? JSON.parse(readFileSync(STORE_PATH, "utf-8"))
      : { assignments: {}, changelog: [], lastSyncAt: null };

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ store, courses: COURSES }));
    return;
  }

  res.writeHead(404);
  res.end("not found");
});

server.listen(PORT, () => {
  console.log(`Dashboard running at http://localhost:${PORT}`);
});
