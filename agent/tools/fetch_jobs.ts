import { defineTool } from "eve/tools";
import { z } from "zod";

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

export default defineTool({
  description:
    "Fetch the latest job listings from yuanjisong.com/job (first page). Returns an array of jobs with id, title, type, location, description, duration, and price.",
  inputSchema: z.object({}),
  async execute(): Promise<{ jobs: Job[] }> {
    const res = await fetch("https://www.yuanjisong.com/job", {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
      },
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch jobs: ${res.status} ${res.statusText}`);
    }

    const html = await res.text();
    const jobs: Job[] = [];

    // Match job links: /job/{id}
    const jobBlocks = html.split(/href="\/job\/(\d+)"/);
    for (let i = 1; i < jobBlocks.length; i += 2) {
      const id = jobBlocks[i];
      const block = jobBlocks[i + 1];

      // Extract title from the link text
      const titleMatch = block.match(/^>([^<]+)</);
      const title = titleMatch ? titleMatch[1].trim() : "";

      // Extract type and location
      const typeMatch = block.match(/类型：([^\n<]+)/);
      const type = typeMatch ? typeMatch[1].trim() : "";

      // Extract description
      const descMatch = block.match(/描述：([^<\n]+)/);
      const description = descMatch ? descMatch[1].trim() : "";

      // Extract duration
      const durationMatch = block.match(/工时：([^<\n]+)/);
      const duration = durationMatch ? durationMatch[1].trim() : "";

      // Extract price
      const priceMatch = block.match(/总价：([^<\n]+)/);
      const price = priceMatch ? priceMatch[1].trim() : "";

      // Parse location from type string
      const locationParts = type.split(/\s+/);
      const location = locationParts.length > 1 ? locationParts.slice(1).join(" ") : "";

      if (id && title) {
        jobs.push({
          id,
          title,
          type: locationParts[0] || type,
          location,
          description,
          duration,
          price,
          url: `https://www.yuanjisong.com/job/${id}`,
        });
      }
    }

    return { jobs };
  },
});
