import { NextResponse } from "next/server";

function getRedis() {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) throw new Error("Missing KV_REST_API_URL or KV_REST_API_TOKEN");
  return { url, token };
}

async function redisCommand(command: string, ...args: (string | number)[]) {
  const { url, token } = getRedis();
  const res = await fetch(`${url}/${command}/${args.join("/")}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json() as Promise<{ result: string | string[] | null }>;
}

async function generateTitle(firstMessage: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return firstMessage.substring(0, 30);
  try {
    const res = await fetch("https://api.edgefn.net/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "GLM-5.2",
        max_tokens: 50,
        messages: [
          { role: "system", content: "用10个字以内概括用户的第一条消息作为对话标题，只输出标题，不要加引号或标点。" },
          { role: "user", content: firstMessage },
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
    const data = await redisCommand("zrevrange", "chat:sessions", 0, -1);
    const sessionIds: string[] = data.result
      ? typeof data.result === "string"
        ? JSON.parse(data.result)
        : data.result
      : [];

    const sessions: SessionMeta[] = [];
    for (const id of sessionIds) {
      const meta = await redisCommand("hgetall", `chat:session:${id}`);
      if (meta.result && typeof meta.result === "object" && !Array.isArray(meta.result)) {
        const m = meta.result as Record<string, string>;
        sessions.push({
          sessionId: id,
          title: m.title || "新对话",
          createdAt: Number(m.createdAt) || 0,
          lastActivityAt: Number(m.lastActivityAt) || 0,
        });
      }
    }

    return NextResponse.json({ sessions });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { sessionId, firstMessage } = body as { sessionId?: string; firstMessage?: string };

    if (!sessionId) {
      return NextResponse.json({ error: "sessionId required" }, { status: 400 });
    }

    const title = firstMessage ? await generateTitle(firstMessage) : "新对话";
    const now = Date.now();

    await redisCommand("zadd", "chat:sessions", now, sessionId);
    await redisCommand("hset", `chat:session:${sessionId}`, "title", title, "createdAt", String(now), "lastActivityAt", String(now));

    return NextResponse.json({ sessionId, title });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
