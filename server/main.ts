// one long-running node process: the api plus the react app.
// dev: vite runs inside express (hot reload). prod (--prod): serves the vite build from dist/
import express from "express";
import { fileURLToPath } from "node:url";
import { api } from "./api";

try {
  process.loadEnvFile(".env");
} catch {
  // no .env, use the shell environment
}

const prod = process.argv.includes("--prod");
const port = Number(process.env.PORT ?? 3000);
const app = express();

app.use(express.json());
app.use("/api", api);

if (prod) {
  const dist = fileURLToPath(new URL("../dist/", import.meta.url));
  app.use(express.static(dist));
  app.get("/{*path}", (_req, res) => res.sendFile("index.html", { root: dist }));
} else {
  const { createServer } = await import("vite");
  const vite = await createServer({ server: { middlewareMode: true }, appType: "spa" });
  app.use(vite.middlewares);
}

app.listen(port, () => {
  console.log(`powerplay ${prod ? "(prod)" : "(dev)"} on http://localhost:${port}`);
});
