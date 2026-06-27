import { NextResponse } from "next/server";

interface Job {
  id: string;
  title: string;
  price: string;
  url: string;
}

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

async function fetchJobs(): Promise<Job[]> {
  const res = await fetch("https://www.r5.cn/task?desc=1&page=1", {
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
  });
  if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
  const html = await res.text();

  const jobs: Job[] = [];
  const seen = new Set<string>();
  const pattern = /href="(https:\/\/www\.r5\.cn\/task\/(\d+))"[^>]*>([^<]+)</g;
  let match;
  while ((match = pattern.exec(html)) !== null) {
    const url = match[1];
    const id = match[2];
    const title = match[3].trim();
    if (seen.has(id) || title.length < 3) continue;
    seen.add(id);
    const block = html.substring(Math.max(0, match.index - 300), Math.min(html.length, match.index + 300));
    const priceMatch = block.match(/(\d+[\d,.]*)\s*元/);
    jobs.push({
      id, title: title.substring(0, 80),
      price: priceMatch ? priceMatch[1] + "元" : "面议",
      url,
    });
  }
  return jobs;
}

async function analyzeJob(job: Job): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return "无描述";
  try {
    const res = await fetch("https://token-plan-sgp.xiaomimimo.com/anthropic/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "mimo-v2.5-pro", max_tokens: 500,
        messages: [{ role: "user", content: `分析以下程序员外包项目，简洁回答（3-5行）：技术难度、适合技术栈、预算是否合理、风险提示、推荐1-5星\n\n标题：${job.title}\n价格：${job.price}` }],
      }),
    });
    const data = (await res.json()) as { content?: Array<{ text?: string }> };
    return data.content?.[0]?.text || "无描述";
  } catch { return "无描述"; }
}

async function sendTelegram(text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) throw new Error("Missing TELEGRAM config");
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown" }),
  });
  const data = (await res.json()) as { ok: boolean; description?: string };
  if (!data.ok) throw new Error(`Telegram error: ${data.description}`);
}

export async function GET() {
  try {
    const jobs = await fetchJobs();
    if (jobs.length === 0) return NextResponse.json({ ok: false, error: "No jobs parsed" }, { status: 502 });

    const seenData = await redisCommand("get", "r5:seen_jobs");
    const seenIds: string[] = seenData.result ? typeof seenData.result === "string" ? JSON.parse(seenData.result) : seenData.result : [];
    const newJobs = jobs.filter((j) => !seenIds.includes(j.id));
    await redisCommand("set", "r5:seen_jobs", JSON.stringify(jobs.map((j) => j.id)));

    if (newJobs.length === 0) return NextResponse.json({ ok: true, message: "No new jobs", totalJobs: jobs.length, newJobs: 0 });

    const results = [];
    for (const job of newJobs) {
      try {
        const analysis = await analyzeJob(job);
        const msg = [`🆕 *${job.title}*`, `💰 ${job.price}`, ``, analysis, ``, `🔗 ${job.url}`].join("\n");
        await sendTelegram(msg);
        results.push({ id: job.id, title: job.title, status: "sent" });
      } catch (err) { results.push({ id: job.id, title: job.title, status: "error", error: String(err) }); }
    }
    return NextResponse.json({ ok: true, totalJobs: jobs.length, newJobs: newJobs.length, results });
  } catch (err) { return NextResponse.json({ ok: false, error: String(err) }, { status: 500 }); }
}
