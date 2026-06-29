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
    "Manage the latest seen job ID in Redis. Actions: 'get' returns the latest ID, 'set' updates it, 'clear' removes it.",
  inputSchema: z.object({
    platform: z.enum(["yuanjisong", "r5"]).describe("Platform to manage"),
    action: z.enum(["get", "set", "clear"]),
    latestId: z
      .number()
      .optional()
      .describe("Latest job ID to set (required for set action)"),
  }),
  async execute({ platform, action, latestId }) {
    const key = `${platform}:latest_id`;

    switch (action) {
      case "get": {
        const data = await redisCommand("get", key);
        return { latestId: data.result ? Number(data.result) : 0 };
      }

      case "set": {
        if (latestId === undefined) return { error: "latestId required for set action" };
        await redisCommand("set", key, String(latestId));
        return { latestId };
      }

      case "clear": {
        await redisCommand("del", key);
        return { latestId: 0 };
      }
    }
  },
});
