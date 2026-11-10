import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Every page in PreVisit is per-user and rendered on request,
// so no incremental cache (R2/KV) is needed.
export default defineCloudflareConfig({});
