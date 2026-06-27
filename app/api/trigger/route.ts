import { NextResponse } from "next/server";

interface Job {
  id: string;
  title: string;
  type: string;
  location: string;
  description: string;
  duration: string;
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

async function firecrawlFetch(url: string): Promise<string> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) throw new Error("Missing FIRECRAWL_API_KEY");
  const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ url, timeout: 60000 }),
  });
  if (!res.ok) throw new Error(`Firecrawl API failed: ${res.status}`);
  const data = (await res.json()) as { success?: boolean; data?: { markdown?: string }; error?: string };
  if (!data.success || !data.data?.markdown) throw new Error(`Firecrawl error: ${data.error || "empty content"}`);
  return data.data.markdown;
}

function parseJobs(text: string): Job[] {
  const jobs: Job[] = [];
  const seen = new Set<string>();
  const pattern = /\[([^\]]+)\]\(https:\/\/www\.yuanjisong\.com\/job\/(\d+)\)/g;
  let match;
  while ((match = pattern.exec(text)) !== null) {
    const title = match[1].replace(/[#*\s]/g, "").trim();
    const id = match[2];
    if (seen.has(id)) continue;
    seen.add(id);
    const block = text.substring(match.index + match[0].length, Math.min(text.length, match.index + match[0].length + 500));
    const typeRaw = block.match(/类型：([^\n]+)/)?.[1]?.trim()?.replace(/\[/g, "").trim() || "";
    const parts = typeRaw.split(/\s+/);
    if (title) {
      jobs.push({
        id, title: title.substring(0, 80),
        type: parts[0] || typeRaw, location: parts.length > 1 ? parts.slice(1).join(" ") : "",
        description: block.match(/描述：([^\n]+)/)?.[1]?.trim()?.substring(0, 200) || "",
        duration: block.match(/工时：([^\n]+)/)?.[1]?.trim() || "",
        price: block.match(/总价：([^\n]+)/)?.[1]?.trim() || "",
        url: `https://www.yuanjisong.com/job/${id}`,
      });
    }
  }
  return jobs;
}

async function analyzeJob(job: Job): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return job.description || "无描述";
  try {
    const res = await fetch("https://token-plan-sgp.xiaomimimo.com/anthropic/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "mimo-v2.5-pro", max_tokens: 500,
        messages: [{ role: "user", content: `分析以下程序员兼职项目，简洁回答（3-5行）：技术难度、适合技术栈、预算是否合理、风险提示、推荐1-5星\n\n标题：${job.title}\n价格：${job.price}\n工时：${job.duration}\n描述：${job.description}` }],
      }),
    });
    const data = (await res.json()) as { content?: Array<{ text?: string }> };
    return data.content?.[0]?.text || job.description || "无描述";
  } catch { return job.description || "无描述"; }
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
    const text = await firecrawlFetch("https://www.yuanjisong.com/job");
    const jobs = parseJobs(text);
    if (jobs.length === 0) return NextResponse.json({ ok: false, error: "No jobs parsed" }, { status: 502 });

    const seenData = await redisCommand("get", "yuanjisong:seen_jobs");
    const seenIds: string[] = seenData.result ? typeof seenData.result === "string" ? JSON.parse(seenData.result) : seenData.result : [];
    const newJobs = jobs.filter((j) => !seenIds.includes(j.id));
    await redisCommand("set", "yuanjisong:seen_jobs", JSON.stringify(jobs.map((j) => j.id)));

    if (newJobs.length === 0) return NextResponse.json({ ok: true, message: "No new jobs", totalJobs: jobs.length, newJobs: 0 });

    const results = [];
    for (const job of newJobs) {
      try {
        const analysis = await analyzeJob(job);
        const msg = [`🆕 *${job.title}*`, `💰 ${job.price || "面议"} | ⏱ ${job.duration || "待定"}`, `📋 ${job.type} | 📍 ${job.location || "未知"}`, ``, analysis, ``, `🔗 ${job.url}`].join("\n");
        await sendTelegram(msg);
        results.push({ id: job.id, title: job.title, status: "sent" });
      } catch (err) { results.push({ id: job.id, title: job.title, status: "error", error: String(err) }); }
    }
    return NextResponse.json({ ok: true, totalJobs: jobs.length, newJobs: newJobs.length, results });
  } catch (err) { return NextResponse.json({ ok: false, error: String(err) }, { status: 500 }); }
}
