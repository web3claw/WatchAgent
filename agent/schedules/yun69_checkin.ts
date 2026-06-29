import { defineSchedule } from "eve/schedules";

export default defineSchedule({
  cron: "0 12 * * *",
  markdown: `You are a daily check-in bot for 69yun69.com. Follow these steps:

## Step 1: Perform check-in
Call the \`checkin_69yun\` tool to perform the daily check-in.

## Step 2: Report result
The tool already sends the result to Telegram. Just confirm the operation completed.

If the tool fails, report the error briefly.`,
});
