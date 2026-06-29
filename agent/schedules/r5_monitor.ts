import { defineSchedule } from "eve/schedules";

export default defineSchedule({
  cron: "0 0 * * *",
  markdown: `You are a job monitor for r5.cn (R5威客). Follow these steps exactly:

## Step 1: Fetch current jobs
Call the \`fetch_r5_jobs\` tool to get all tasks from the first page.

## Step 2: Load latest seen ID
Call \`manage_seen_jobs\` with platform "r5" and action "get" to retrieve the latest seen job ID.

## Step 3: Find new jobs
Any job with an ID greater than the latest seen ID is new.

## Step 4: For each new job (ascending ID order)
For each new job:
1. The job already includes a description from the detail page
2. Analyze the job and write a brief assessment
3. Send analysis to Telegram via \`send_telegram\`
4. If all new jobs succeed, call \`manage_seen_jobs\` with platform "r5", action "set", and the highest job ID

## Important
- Only update the latest ID after all new jobs are processed successfully
- Keep messages concise but informative`,
});
