// one long-running node process: the api plus the react app.
// dev: vite runs inside express (hot reload). prod (--prod): serves the vite build from dist/
// binds every interface (0.0.0.0): phones on the wifi, a tunnel or a host's proxy can all reach it
import "./env";
import express from "express";
import { networkInterfaces } from "node:os";
import { fileURLToPath } from "node:url";
import { healthz } from "@/features/site/server/routes/health";
import { startup, stopOnSignals } from "@/features/site/server/routes/startup";
import { api } from "./api";

const prod = process.argv.includes("--prod");
const port = Number(process.env.PORT ?? 3000);
const app = express();

// one proxy in front (a tunnel or the host's load balancer): req.secure and the origin come from
// its x-forwarded-* headers, so cookies are Secure over https and links use the public address
app.set("trust proxy", 1);
app.get("/healthz", healthz);
app.use(express.json({ limit: "32kb" }));
app.use("/api", api);

if (prod) {
  const dist = fileURLToPath(new URL("../dist/", import.meta.url));
  app.use(express.static(dist));
  app.get("/{*path}", (_req, res) => res.sendFile("index.html", { root: dist }));
} else {
  const { createServer } = await import("vite");
  // vite's dev server refuses unknown host names: let the tunnel's (and PUBLIC_BASE_URL's) through
  const publicHost = process.env.PUBLIC_BASE_URL ? new URL(process.env.PUBLIC_BASE_URL).hostname : null;
  const allowedHosts = [".trycloudflare.com", ...(publicHost ? [publicHost] : [])];
  const vite = await createServer({ server: { middlewareMode: true, allowedHosts }, appType: "spa" });
  app.use(vite.middlewares);
}

await startup();
stopOnSignals();
app.listen(port, "0.0.0.0", () => {
  const lan = Object.values(networkInterfaces())
    .flat()
    .filter((i) => i && i.family === "IPv4" && !i.internal)
    .map((i) => `http://${i!.address}:${port}`);
  console.log(
    `powerplay ${prod ? "(prod)" : "(dev)"} on http://localhost:${port}${lan.length ? ` · on the wifi: ${lan.join(", ")}` : ""}`,
  );
});
