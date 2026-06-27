import { defineTool } from "eve/tools";
import { z } from "zod";

function getRedis() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    throw new Error("Missing KV_REST_API_URL/KV_REST_API_TOKEN");
  }
  return { url, token };
}

async function redisCommand(command: string, ...args: (string | number)[]) {
  const { url, token } = getRedis();
  const res = await fetch(`${url}/${command}/${args.join("/")}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json() as Promise<{ result: string | string[] | null }>;
}

export default defineTool({
  description:
    "Manage the seen jobs list in Redis. Actions: 'get' returns all seen job IDs, 'add' appends new IDs, 'set' replaces the entire list, 'clear' removes all.",
  inputSchema: z.object({
    action: z.enum(["get", "add", "set", "clear"]),
    jobIds: z
      .array(z.string())
      .optional()
      .describe("Job IDs to add or set (required for add/set actions)"),
  }),
  async execute({ action, jobIds }) {
    const key = "yuanjisong:seen_jobs";

    switch (action) {
      case "get": {
        const data = await redisCommand("get", key);
        if (!data.result) return { jobIds: [] };
        const ids = typeof data.result === "string" ? JSON.parse(data.result) : data.result;
        return { jobIds: ids };
      }

      case "add": {
        if (!jobIds?.length) return { error: "jobIds required for add action" };
        const existing = await redisCommand("get", key);
        const current: string[] = existing.result
          ? typeof existing.result === "string"
            ? JSON.parse(existing.result)
            : existing.result
          : [];
        const merged = [...new Set([...current, ...jobIds])];
        await redisCommand("set", key, JSON.stringify(merged));
        return { jobIds: merged, added: jobIds.length };
      }

      case "set": {
        if (!jobIds) return { error: "jobIds required for set action" };
        await redisCommand("set", key, JSON.stringify(jobIds));
        return { jobIds, total: jobIds.length };
      }

      case "clear": {
        await redisCommand("del", key);
        return { jobIds: [] };
      }
    }
  },
});
