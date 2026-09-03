import { execFile } from "node:child_process";
import { createServer } from "node:http";
import { hostname, networkInterfaces } from "node:os";
import { promisify } from "node:util";
import { isCloudMode } from "../config.js";
import { handleRequest } from "./handler.js";
import type { PhoneAccessInfo } from "./render.js";

const execFileAsync = promisify(execFile);
const PORT = Number(process.env.PORT ?? 4127);

if (isCloudMode()) {
  console.warn(
    "Warning: UPSTASH_REDIS_REST_URL is set, but this is the local dev server — it will write to your cloud store, not a local file. That's usually not what you want for local development.",
  );
}

/**
 * Which of this machine's IPv4 addresses is Tailscale's own virtual
 * interface, asked directly (`tailscale ip -4`) rather than guessed from
 * its IP range — some campus Wi-Fi networks (this one included) hand out
 * addresses in the same 100.64.0.0/10 CGNAT space Tailscale uses for its
 * overlay, so range-sniffing alone mislabels a perfectly ordinary Wi-Fi
 * address as "Tailscale." Returns undefined if the `tailscale` CLI isn't
 * installed or isn't logged in — most students won't have it, and that's
 * fine, it's presented as an optional fallback, never the default.
 */
async function tailscaleAddress(): Promise<string | undefined> {
  try {
    const { stdout } = await execFileAsync("tailscale", ["ip", "-4"], { timeout: 2000 });
    const ip = stdout.trim().split("\n")[0]?.trim();
    return ip && /^\d+\.\d+\.\d+\.\d+$/.test(ip) ? ip : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Every non-internal IPv4 address this machine has, split into "ordinary
 * Wi-Fi/Ethernet LAN" vs. Tailscale's virtual address. Only meaningful for
 * the local dev server — a deployed instance (docs/ARCHITECTURE.md §12)
 * doesn't need any of this, it's already reachable from anywhere.
 */
async function detectedAddresses(): Promise<{ lan: string[]; tailscale: string[] }> {
  const nets = networkInterfaces();
  const all: string[] = [];
  for (const iface of Object.values(nets)) {
    for (const net of iface ?? []) {
      if (net.family === "IPv4" && !net.internal) all.push(net.address);
    }
  }
  const tsAddr = await tailscaleAddress();
  const tailscale = tsAddr && all.includes(tsAddr) ? [tsAddr] : [];
  const lan = all.filter((a) => a !== tsAddr);
  return { lan, tailscale };
}

export async function phoneAccessInfo(): Promise<PhoneAccessInfo> {
  const { lan, tailscale } = await detectedAddresses();
  const localHostname = hostname().endsWith(".local") ? hostname() : `${hostname()}.local`;
  return { lan, tailscale, localHostname, port: PORT };
}

const server = createServer((req, res) => {
  void handleRequest(req, res, phoneAccessInfo);
});

// Bind to all interfaces (not just localhost) so a phone on the same Wi-Fi can reach
// this — see docs/ARCHITECTURE.md §9. For reachability from anywhere, without this
// machine needing to be on at all, deploy instead (docs/ARCHITECTURE.md §12,
// `npm run deploy`).
server.listen(PORT, "0.0.0.0", async () => {
  console.log(`Docket dashboard running at http://localhost:${PORT}`);
  const { lan, tailscale, localHostname } = await phoneAccessInfo();
  if (lan.length > 0) {
    console.log(`On your phone (same Wi-Fi, no install needed): http://${localHostname}:${PORT}  (or by IP: ${lan.map((a) => `http://${a}:${PORT}`).join(", ")})`);
  }
  if (tailscale.length > 0) {
    console.log(`Tailscale detected — also reachable from anywhere at: ${tailscale.map((a) => `http://${a}:${PORT}`).join(", ")}`);
  }
  if (lan.length === 0 && tailscale.length === 0) {
    console.log(`No network interface detected for phone access — see docs/ARCHITECTURE.md §9.`);
  }
  console.log(`For access from anywhere without this computer needing to be on, deploy: see docs/ARCHITECTURE.md §12.`);
});
