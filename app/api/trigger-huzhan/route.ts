import { NextResponse } from "next/server";

interface Job {
  id: string;
  title: string;
  price: string;
  description: string;
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

async function fetchJobDetail(id: string): Promise<string> {
  try {
    const res = await fetch(`https://task.huzhan.com/${id}/`, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
    });
    if (!res.ok) return "";
    const html = await res.text();
    // 提取任务描述区域
    const descMatch = html.match(/class="task_content[^"]*"[^>]*>([\s\S]*?)<\/div>/);
    if (descMatch) {
      return descMatch[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().substring(0, 500);
    }
    return "";
  } catch { return ""; }
}

async function fetchJobs(): Promise<Job[]> {
  const res = await fetch("https://task.huzhan.com/order/time", {
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
  });
  if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
  const html = await res.text();

  const jobs: Job[] = [];
  const seen = new Set<string>();
  const pattern = /href="(?:https:\/\/task\.huzhan\.com)?\/(\d+)\/"[^>]*>([^<]+)</g;
  let match;
  while ((match = pattern.exec(html)) !== null) {
    const id = match[1];
    const title = match[2].trim();
    if (seen.has(id) || title.length < 3) continue;
    seen.add(id);
    const block = html.substring(Math.max(0, match.index - 500), Math.min(html.length, match.index + 500));
    const priceMatch = block.match(/(\d+[\d,.]*)\s*元/);
    jobs.push({
      id, title: title.substring(0, 80),
      price: priceMatch ? priceMatch[1] + "元" : "面议",
      description: "",
      url: `https://task.huzhan.com/${id}/`,
    });
  }
  return jobs;
}

async function analyzeJob(job: Job): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return "无描述";
  try {
    const res = await fetch("https://api.edgefn.net/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "GLM-5.2", max_tokens: 2000,
        messages: [
          { role: "system", content: "你是外包项目分析助手。直接输出分析，不要输出思考过程。格式：难度：xxx\n技术栈：xxx\n价格分析：xxx\n工期分析：xxx\n风险提示：xxx\n推荐：⭐⭐⭐" },
          { role: "user", content: `标题：${job.title}\n价格：${job.price}\n要求：${job.description || "无"}` },
        ],
      }),
    });
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string; reasoning_content?: string } }> };
    return data.choices?.[0]?.message?.content || data.choices?.[0]?.message?.reasoning_content || "无描述";
  } catch { return "无描述"; }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function sendTelegram(text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) throw new Error("Missing TELEGRAM config");
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
  });
  const data = (await res.json()) as { ok: boolean; description?: string };
  if (!data.ok) throw new Error(`Telegram error: ${data.description}`);
}

export async function GET() {
  try {
    const jobs = await fetchJobs();
    if (jobs.length === 0) return NextResponse.json({ ok: false, error: "No jobs parsed" }, { status: 502 });

    const seenData = await redisCommand("get", "huzhan:latest_id");
    const latestId = seenData.result ? Number(seenData.result) : 0;
    const newJobs = jobs.filter((j) => Number(j.id) > latestId);

    if (newJobs.length === 0) return NextResponse.json({ ok: true, message: "No new jobs", totalJobs: jobs.length, newJobs: 0 });

    // 抓取新任务的详情
    for (const job of newJobs) {
      job.description = await fetchJobDetail(job.id);
    }

    const results = [];
    const succeededIds = new Set<number>();
    for (const job of newJobs) {
      try {
        const analysis = await analyzeJob(job);
        const desc = job.description ? `\n📋 ${escapeHtml(job.description)}` : "";
        const msg = [`🆕 <b>${escapeHtml(job.title)}</b>`, `💰 ${escapeHtml(job.price)}`, desc, ``, escapeHtml(analysis), ``, `🔗 ${job.url}`].join("\n");
        await sendTelegram(msg);
        results.push({ id: job.id, title: job.title, status: "sent" });
        succeededIds.add(Number(job.id));
      } catch (err) { results.push({ id: job.id, title: job.title, status: "error", error: String(err) }); }
    }

    // 升序处理，遇到第一个失败就停，存失败ID-1（失败的和更高的下次重试）
    let newLatestId = latestId;
    for (const job of newJobs.sort((a, b) => Number(a.id) - Number(b.id))) {
      if (!succeededIds.has(Number(job.id))) {
        newLatestId = Number(job.id) - 1;
        break;
      }
    }
    // 全部成功时更新到最后一个
    if (newLatestId === latestId && newJobs.every((j) => succeededIds.has(Number(j.id)))) {
      newLatestId = Number(newJobs[newJobs.length - 1].id);
    }
    await redisCommand("set", "huzhan:latest_id", String(newLatestId));
    return NextResponse.json({ ok: true, totalJobs: jobs.length, newJobs: newJobs.length, results });
  } catch (err) { return NextResponse.json({ ok: false, error: String(err) }, { status: 500 }); }
}
