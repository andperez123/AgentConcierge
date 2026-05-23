import cors from "cors";
import express from "express";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { DASHBOARD_DIST, MOCK_OPENCLAW, PORT } from "./config.js";
import apiRouter from "./routes.js";
import { ensureDefaultWeatherLocation } from "./settings.js";

void ensureDefaultWeatherLocation().catch((err) => {
  console.warn("Could not seed default weather location:", err);
});

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api", apiRouter);

if (existsSync(DASHBOARD_DIST)) {
  app.use(express.static(DASHBOARD_DIST));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api")) return next();
    res.sendFile(join(DASHBOARD_DIST, "index.html"));
  });
} else {
  app.get("/", (_req, res) => {
    res.type("text").send(
      "Concierge API running. Build dashboard: npm run build -w @concierge/dashboard\n",
    );
  });
}

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Concierge API on http://0.0.0.0:${PORT}`);
  console.log(`Mock OpenClaw: ${MOCK_OPENCLAW}`);
  if (existsSync(DASHBOARD_DIST)) {
    console.log(`Serving dashboard from ${DASHBOARD_DIST}`);
  }
});
