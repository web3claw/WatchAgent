import { NextResponse } from "next/server";

function getRedis() {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) throw new Error("Missing KV_REST_API_URL or KV_REST_API_TOKEN");
  return { url, token };
}

async function redisCommand(command: string, ...args: (string | number)[]) {
  const { url, token } = getRedis();
  const requestUrl = `${url}/${command}/${args.join("/")}`;
  const res = await fetch(requestUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json() as { result?: string | string[] | null; error?: string };
  if (data.error) throw new Error(`Redis ${command}: ${data.error}`);
  return data;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const data = await redisCommand("get", `chat:messages:${id}`);
    const messages = data.result ? (typeof data.result === "string" ? JSON.parse(data.result) : []) : [];
    return NextResponse.json({ messages });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { messages } = body as { messages?: unknown[] };

    if (!messages) {
      return NextResponse.json({ error: "messages required" }, { status: 400 });
    }

    await redisCommand("set", `chat:messages:${id}`, JSON.stringify(messages));
    // Update lastActivityAt
    await redisCommand("zadd", "chat:sessions", Date.now(), id);
    await redisCommand("hset", `chat:session:${id}`, "lastActivityAt", String(Date.now()));

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    await redisCommand("zrem", "chat:sessions", id);
    await redisCommand("del", `chat:session:${id}`);
    await redisCommand("del", `chat:messages:${id}`);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
