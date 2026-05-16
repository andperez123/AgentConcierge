import { readFileSync, statfsSync } from "node:fs";
import { freemem, totalmem } from "node:os";
import type { DeviceMetric } from "@concierge/shared";
import { DATA_DIR } from "../config.js";

function readCpuTempC(): number | undefined {
  try {
    const raw = readFileSync(
      "/sys/class/thermal/thermal_zone0/temp",
      "utf8",
    ).trim();
    const n = Number(raw);
    if (Number.isFinite(n)) return n / 1000;
  } catch {
    /* not on Pi */
  }
  return undefined;
}

function levelForTemp(c: number): DeviceMetric["level"] {
  if (c >= 80) return "critical";
  if (c >= 70) return "warning";
  return "ok";
}

function levelForPercent(p: number): DeviceMetric["level"] {
  if (p >= 90) return "critical";
  if (p >= 75) return "warning";
  return "ok";
}

export function collectDeviceMetrics(): DeviceMetric[] {
  const metrics: DeviceMetric[] = [];

  const temp = readCpuTempC();
  if (temp !== undefined) {
    metrics.push({
      label: "CPU temp",
      value: `${temp.toFixed(1)}°C`,
      level: levelForTemp(temp),
    });
  }

  const total = totalmem();
  const free = freemem();
  const usedPct = Math.round(((total - free) / total) * 100);
  metrics.push({
    label: "Memory",
    value: `${usedPct}% used`,
    level: levelForPercent(usedPct),
  });

  try {
    const { bsize, blocks, bavail } = statfsSync(DATA_DIR);
    const totalBytes = bsize * blocks;
    const freeBytes = bsize * bavail;
    const diskPct = Math.round(((totalBytes - freeBytes) / totalBytes) * 100);
    metrics.push({
      label: "Disk",
      value: `${diskPct}% used`,
      level: levelForPercent(diskPct),
    });
  } catch {
    metrics.push({ label: "Disk", value: "unknown", level: "ok" });
  }

  return metrics;
}

export async function checkNetworkOnline(): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 3000);
    const res = await fetch("https://api.open-meteo.com", {
      method: "HEAD",
      signal: ctrl.signal,
    });
    clearTimeout(t);
    return res.ok || res.status < 500;
  } catch {
    return false;
  }
}
