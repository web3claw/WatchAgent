import { defineTool } from "eve/tools";
import { z } from "zod";

interface JobDetail {
  id: string;
  title: string;
  type: string;
  dailyRate: string;
  totalPrice: string;
  duration: string;
  location: string;
  description: string;
  applicants: string;
  publisher: string;
  url: string;
}

export default defineTool({
  description:
    "Fetch detailed information for a specific job from yuanjisong.com by job ID. Returns full job details including description, price, duration, and location.",
  inputSchema: z.object({
    jobId: z.string().describe("The job ID from yuanjisong.com (e.g. '159708')"),
  }),
  async execute({ jobId }): Promise<JobDetail> {
    const url = `https://www.yuanjisong.com/job/${jobId}`;
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
      },
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch job ${jobId}: ${res.status} ${res.statusText}`);
    }

    const html = await res.text();
    const text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, "\n")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    const extract = (pattern: RegExp): string => {
      const m = text.match(pattern);
      return m ? m[1].trim() : "";
    };

    const title = extract(/职位ID:\d+\s*\n*(.+?)(?:\n|合作方式)/);
    const type = extract(/合作方式：\s*(.+?)(?:\n|预估)/);
    const dailyRate = extract(/预估日薪：\s*(.+?)(?:\n|预估总价)/);
    const totalPrice = extract(/预估总价：\s*(.+?)(?:\n|预估工时)/);
    const duration = extract(/预估工时：\s*(.+?)(?:\n|所在区域)/);
    const location = extract(/所在区域：\s*(.+?)(?:\n|需求描述)/);
    const description = extract(/需求描述[\s\S]*?\n*([\s\S]+?)(?:\n投递职位|\n信用行为)/);
    const applicants = extract(/已有(\d+)人投递/);
    const publisher = text.match(/(\S+)发布需求/)?.[1] || "";

    return {
      id: jobId,
      title,
      type,
      dailyRate,
      totalPrice,
      duration,
      location,
      description: description.substring(0, 2000),
      applicants,
      publisher,
      url,
    };
  },
});
