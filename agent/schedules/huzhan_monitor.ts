import { defineSchedule } from "eve/schedules";

export default defineSchedule({
  cron: "0 0 * * *",
  markdown: `You are a job monitor for huzhan.com (互站网). Call the built-in tools to:

1. Fetch jobs from https://task.huzhan.com/order/time using the web_fetch tool
2. Read the latest seen job ID from Redis via manage_seen_jobs (platform "yuanjisong" won't work here — use the trigger-huzhan API route directly if needed, or fetch and compare IDs manually)
3. Any job with an ID greater than the stored latest ID is new
4. For each new job, analyze it and send to Telegram via send_telegram
5. Update Redis with the new highest job ID

Keep messages concise with: title, price, AI analysis, and link.`,
});
