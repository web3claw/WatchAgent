import { defineTool } from "eve/tools";
import { z } from "zod";

export default defineTool({
  description:
    "Send a message to a Telegram chat via Bot API. Requires TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID environment variables.",
  inputSchema: z.object({
    text: z.string().describe("Message text to send (supports Markdown formatting)"),
  }),
  async execute({ text }): Promise<{ ok: boolean; messageId?: number }> {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!token || !chatId) {
      throw new Error("Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID");
    }

    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "Markdown",
      }),
    });

    const data = (await res.json()) as {
      ok: boolean;
      result?: { message_id: number };
      description?: string;
    };

    if (!data.ok) {
      throw new Error(`Telegram API error: ${data.description}`);
    }

    return { ok: true, messageId: data.result?.message_id };
  },
});
