import { defineSchedule } from "eve/schedules";

export default defineSchedule({
  cron: "0 0 * * *",
  markdown: `You are a job monitor for huzhan.com (互站网). Call the built-in tools to:

1. Fetch jobs from https://task.huzhan.com/order/time/page/1 using the web_fetch tool
2. Read /workspace/huzhan_seen_jobs.txt for previously seen job IDs
3. Find new jobs not in the seen list
4. For each new job, analyze it and send to Telegram via send_telegram
5. Write all current job IDs to /workspace/huzhan_seen_jobs.txt

Keep messages concise with: title, price, AI analysis, and link.`,
});
