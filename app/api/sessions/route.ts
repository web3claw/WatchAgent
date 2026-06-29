import { NextResponse } from "next/server";

function getRedis() {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) throw new Error("Missing KV_REST_API_URL or KV_REST_API_TOKEN");
  return { url, token };
}

async function redisCommand(command: string, ...args: (string | number)[]) {
  const { url, token } = getRedis();
  const body = args.map(String);
  const res = await fetch(`${url}/${command}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = await res.json() as { result?: string | string[] | null; error?: string };
  if (data.error) throw new Error(`Redis ${command}: ${data.error}`);
  return data;
}

async function generateTitle(firstMessage: string, responseMessage?: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return firstMessage.substring(0, 30);
  try {
    const context = responseMessage
      ? `用户问：${firstMessage}\n助手答：${responseMessage}`
      : firstMessage;
    const res = await fetch("https://api.edgefn.net/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "GLM-5.2",
        max_tokens: 50,
        messages: [
          { role: "system", content: "根据对话内容生成一个简短标题，10个字以内，只输出标题，不要加引号或标点。" },
          { role: "user", content: context },
        ],
      }),
    });
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    return data.choices?.[0]?.message?.content?.trim() || firstMessage.substring(0, 30);
  } catch {
    return firstMessage.substring(0, 30);
  }
}

interface SessionMeta {
  sessionId: string;
  title: string;
  createdAt: number;
  lastActivityAt: number;
}

export async function GET() {
  try {
    // First check if key exists
    const lenResult = await redisCommand("zcard", "chat:sessions");
    const total = typeof lenResult.result === "number" ? lenResult.result : 0;

    const data = await redisCommand("zrevrange", "chat:sessions", 0, -1);
    const rawResult = data.result;
    let sessionIds: string[] = [];
    if (Array.isArray(rawResult)) {
      sessionIds = rawResult;
    } else if (typeof rawResult === "string" && rawResult.length > 0) {
      // Upstash returns comma-separated string
      sessionIds = rawResult.split(",").filter(Boolean);
    }

    const sessions: SessionMeta[] = [];
    for (const id of sessionIds) {
      const meta = await redisCommand("hgetall", `chat:session:${id}`);
      const result = meta.result;
      let m: Record<string, string> = {};
      if (Array.isArray(result)) {
        for (let i = 0; i < result.length; i += 2) {
          m[result[i]] = result[i + 1] || "";
        }
      } else if (result && typeof result === "object") {
        m = result as Record<string, string>;
      }
      sessions.push({
        sessionId: id,
        title: m.title || "新对话",
        createdAt: Number(m.createdAt) || 0,
        lastActivityAt: Number(m.lastActivityAt) || 0,
      });
    }

    return NextResponse.json({ sessions });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { sessionId, firstMessage, responseMessage } = body as {
      sessionId?: string;
      firstMessage?: string;
      responseMessage?: string;
    };

    if (!sessionId) {
      return NextResponse.json({ error: "sessionId required" }, { status: 400 });
    }

    const title = firstMessage ? await generateTitle(firstMessage, responseMessage) : "新对话";
    const now = Date.now();

    await redisCommand("zadd", "chat:sessions", now, sessionId);
    await redisCommand("hset", `chat:session:${sessionId}`, "title", title, "createdAt", String(now), "lastActivityAt", String(now));

    return NextResponse.json({ sessionId, title });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
