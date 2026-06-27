import { defineSchedule } from "eve/schedules";

export default defineSchedule({
  cron: "0 0 * * *",
  markdown: `You are a job monitor for yuanjisong.com (猿急送). Follow these steps exactly:

## Step 1: Fetch current jobs
Call the \`fetch_jobs\` tool to get all jobs from the first page.

## Step 2: Load seen job IDs
Call \`manage_seen_jobs\` with action "get" to retrieve the list of previously seen job IDs.

## Step 3: Find new jobs
Compare the fetched job IDs against the seen list. Identify any jobs that are NOT in the seen list.

## Step 4: For each new job
For each new job:
1. Call \`fetch_job_detail\` with the job ID to get full details
2. Analyze the job and write a brief assessment covering:
   - 技术栈匹配度 (tech stack match)
   - 预算合理性 (budget reasonableness)
   - 项目可行性 (project feasibility)
   - 推荐指数 1-5 星 (recommendation score)
3. Format the analysis as a Telegram message and call \`send_telegram\` to send it

## Step 5: Update seen jobs
Call \`manage_seen_jobs\` with action "set" and ALL current job IDs (from step 1) to replace the stored list.

## Important
- If there are no new jobs, still update the seen list (new jobs may have replaced old ones) and finish silently
- Each Telegram message should include: job title, price, duration, location, description summary, and your analysis
- Keep messages concise but informative`,
});
