import { defineTool } from "eve/tools";
import { z } from "zod";

interface R5Job {
  id: string;
  title: string;
  price: string;
  description: string;
  url: string;
}

async function fetchJobDetail(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
    });
    if (!res.ok) return "";
    const html = await res.text();
    const cleaned = html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");
    const textMatch = cleaned.match(/<div class="text">([\s\S]*?)<\/div>/);
    if (textMatch) {
      return textMatch[1].replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim().substring(0, 500);
    }
    return "";
  } catch { return ""; }
}

export default defineTool({
  description:
    "Fetch the latest task listings from r5.cn (R5威客). Returns an array of tasks with id, title, price, description, and url.",
  inputSchema: z.object({}),
  async execute(): Promise<{ jobs: R5Job[] }> {
    const res = await fetch("https://www.r5.cn/task?desc=1&page=1", {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
    });
    if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
    const html = await res.text();

    const jobs: R5Job[] = [];
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
      const description = await fetchJobDetail(url);
      jobs.push({
        id,
        title: title.substring(0, 80),
        price: priceMatch ? priceMatch[1] + "元" : "面议",
        description,
        url,
      });
    }
    return { jobs };
  },
});
