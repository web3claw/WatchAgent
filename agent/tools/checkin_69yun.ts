import { defineTool } from "eve/tools";
import { z } from "zod";

const BASE = "https://69yun69.com";
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

function extractCookies(res: Response): string {
  const setCookies: string[] =
    typeof (res.headers as any).getSetCookie === "function"
      ? (res.headers as any).getSetCookie()
      : (res.headers.get("set-cookie") ?? "").split(/,(?=\s*[^=;]+=)/);
  const jar = new Map<string, string>();
  for (const raw of setCookies) {
    if (!raw) continue;
    const [pair] = raw.split(";");
    const eq = pair.indexOf("=");
    if (eq < 1) continue;
    jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
  }
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

async function login(email: string, password: string): Promise<string> {
  const body = new URLSearchParams({ email, passwd: password, remember_me: "on", code: "" });
  const r = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Origin: BASE,
      Referer: `${BASE}/auth/login`,
      "User-Agent": UA,
      "X-Requested-With": "XMLHttpRequest",
      Accept: "application/json, text/plain, */*",
    },
    body,
    redirect: "manual",
  });
  const text = await r.text();
  let data: { ret: number; msg?: string };
  try { data = JSON.parse(text); } catch { throw new Error(`Login HTTP ${r.status}: ${text.slice(0, 200)}`); }
  if (data.ret !== 1) throw new Error(`Login failed: ${data.msg}`);
  const cookie = extractCookies(r);
  if (!cookie) throw new Error("No Set-Cookie from login");
  return cookie;
}

async function checkin(cookie: string) {
  const r = await fetch(`${BASE}/user/checkin`, {
    method: "POST",
    headers: {
      Cookie: cookie,
      Origin: BASE,
      Referer: `${BASE}/user`,
      "User-Agent": UA,
      "X-Requested-With": "XMLHttpRequest",
      Accept: "application/json, text/plain, */*",
    },
    body: "",
  });
  return r.json() as Promise<any>;
}

function fmtBytes(n: number | undefined): string {
  if (!n || !Number.isFinite(n) || n <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(Math.floor(Math.log(n) / Math.log(1024)), units.length - 1);
  return `${(n / Math.pow(1024, i)).toFixed(2)} ${units[i]}`;
}

export default defineTool({
  description:
    "Perform daily check-in on 69yun69.com to earn traffic. Requires YUN69_EMAIL and YUN69_PASSWORD env vars. Sends result to Telegram.",
  inputSchema: z.object({}),
  async execute(): Promise<{ ok: boolean; msg: string }> {
    const email = process.env.YUN69_EMAIL;
    const password = process.env.YUN69_PASSWORD;
    if (!email || !password) throw new Error("Missing YUN69_EMAIL or YUN69_PASSWORD");

    const cookie = await login(email, password);
    const result = await checkin(cookie);

    const ti = result.trafficInfo ?? {};
    let msg: string;
    if (result.ret === 1) {
      msg = [
        `✅ 69yun69 签到成功`,
        `${(result.msg ?? "").split("\n")[0]}`,
        `套餐总量: ${result.traffic ?? "?"}`,
        `今日已用: ${ti.todayUsedTraffic ?? "?"}`,
        `剩余可用: ${ti.unUsedTraffic ?? "?"}`,
        typeof result.unflowtraffic === "number" ? `raw余量: ${fmtBytes(result.unflowtraffic)}` : "",
      ].filter(Boolean).join("\n");
    } else {
      msg = `ℹ️ 69yun69 签到: ${result.msg ?? "今日已签到"}`;
    }

    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (token && chatId) {
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text: msg }),
      });
    }

    return { ok: result.ret === 1, msg };
  },
});
