// Vercel entry point — every non-/api/* request is rewritten here (see
// vercel.json). Deliberately plain compiled JS importing from dist/, not
// raw TypeScript: Vercel's build runs `npm run build` first (buildCommand
// in vercel.json), so dist/ already exists and is known-correct — pointing
// the function at it avoids any uncertainty about whether Vercel's own
// bundler resolves this project's NodeNext-style ".js"-importing-".ts"
// convention the same way `tsc` does. See docs/ARCHITECTURE.md §12.
import { handleRequest } from "../dist/src/server/handler.js";

export default async function handler(req, res) {
  // No phone-access provider here on purpose — there's no local network to
  // report from a deployed function, and shelling out to a `tailscale`
  // binary that doesn't exist in this environment would just add latency.
  await handleRequest(req, res);
}
