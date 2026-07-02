import { defineSchedule } from "eve/schedules";

export default defineSchedule({
  cron: "0 0 * * *",
  markdown: `你是互站网(huzhan.com)任务监控助手。严格按照以下步骤执行，不要跳步：

步骤1：获取任务列表
调用 web_fetch 访问 https://task.huzhan.com/order/time 获取HTML，提取所有任务ID和标题。

步骤2：获取最新已处理ID
调用 manage_seen_jobs 获取当前存储的最新ID。

步骤3：逐个处理新任务
对于每个ID大于已存储值的新任务，按顺序执行：
  a) 调用 web_fetch 访问 https://task.huzhan.com/{任务ID}/ 获取详情
  b) 分析任务：难度、技术栈、价格合理性、工期、风险、推荐指数(1-5星)
  c) 立即调用 send_telegram 发送这一条任务的消息，格式如下：

🆕 任务标题
💰 价格
📋 任务描述摘要
🤖 难度：xxx
技术栈：xxx
价格分析：xxx
工期分析：xxx
风险提示：xxx
推荐：⭐⭐⭐
🔗 链接

  d) 发送完毕后继续处理下一个新任务

步骤4：更新ID
所有新任务都单独发送Telegram后，调用 manage_seen_jobs 更新最新ID。

关键规则：
- 每个任务必须单独发送一条Telegram消息，绝对不要汇总
- 必须对每个新任务进行AI分析后再发送
- 按任务ID从小到大顺序处理`,
});
