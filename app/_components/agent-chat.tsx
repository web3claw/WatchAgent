"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useEveAgent } from "eve/react";
import { AlertCircleIcon } from "lucide-react";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput,
  type PromptInputMessage,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/components/ai-elements/prompt-input";
import { cn } from "@/lib/utils";
import { AgentMessage } from "./agent-message";

const AGENT_NAME = "watchagent";

type AgentStatus = ReturnType<typeof useEveAgent>["status"];

interface StoredSession {
  sessionId: string;
  continuationToken: string;
  streamIndex: number;
}

interface StoredMessage {
  role: string;
  text?: string;
  parts?: { type: string; text: string }[];
}

function loadSession(sessionId: string): StoredSession | null {
  try {
    const raw = localStorage.getItem(`eve-session:${sessionId}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveSession(sessionId: string, state: { sessionId?: string; continuationToken?: string; streamIndex: number }) {
  if (state.sessionId && state.continuationToken) {
    localStorage.setItem(
      `eve-session:${state.sessionId}`,
      JSON.stringify({
        sessionId: state.sessionId,
        continuationToken: state.continuationToken,
        streamIndex: state.streamIndex,
      }),
    );
  }
}

async function saveMessages(sessionId: string, messages: { role: string; parts: { type: string; text: string }[] }[]) {
  try {
    await fetch(`/api/sessions/${sessionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages }),
    });
  } catch {
    // ignore
  }
}

async function loadMessages(sessionId: string): Promise<StoredMessage[] | null> {
  try {
    const res = await fetch(`/api/sessions/${sessionId}`);
    const data = await res.json();
    return data.messages || null;
  } catch {
    return null;
  }
}

export function AgentChat({
  activeSessionId,
  onSessionCreated,
}: {
  activeSessionId: string | null;
  onSessionCreated: (sessionId: string) => void;
}) {
  const registeredRef = useRef(false);
  const titleGeneratedRef = useRef(false);
  const [savedMessages, setSavedMessages] = useState<StoredMessage[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const getInitialSession = useCallback(() => {
    if (activeSessionId) {
      const stored = loadSession(activeSessionId);
      if (stored) {
        return {
          sessionId: stored.sessionId,
          continuationToken: stored.continuationToken,
          streamIndex: stored.streamIndex,
        };
      }
    }
    return undefined;
  }, [activeSessionId]);

  const agent = useEveAgent({
    initialSession: getInitialSession(),
    onSessionChange: (state) => {
      if (state.sessionId) {
        saveSession(state.sessionId, state);
      }
    },
  });

  const isBusy = agent.status === "submitted" || agent.status === "streaming";
  const isEmpty = agent.data.messages.length === 0 && savedMessages.length === 0;

  // Load saved messages from Redis when restoring a session
  useEffect(() => {
    if (!activeSessionId) {
      setSavedMessages([]);
      return;
    }
    setLoadingHistory(true);
    loadMessages(activeSessionId).then((msgs) => {
      setSavedMessages(msgs || []);
      setLoadingHistory(false);
    });
  }, [activeSessionId]);

  // Save all messages to Redis after streaming completes
  useEffect(() => {
    const sid = agent.session?.sessionId;
    if (sid && agent.data.messages.length > 0 && !isBusy) {
      const msgs = agent.data.messages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({
          role: m.role,
          parts: m.parts.map((p) => ({ type: p.type, text: p.type === "text" ? p.text : "" })),
        }));
      const timeout = setTimeout(() => saveMessages(sid, msgs), 500);
      return () => clearTimeout(timeout);
    }
  }, [agent.data.messages, agent.session?.sessionId, isBusy]);

  // Auto-register session after first message
  useEffect(() => {
    const sid = agent.session?.sessionId;
    if (sid && !registeredRef.current && agent.data.messages.length > 0) {
      registeredRef.current = true;
      const firstUserMsg = agent.data.messages.find((m) => m.role === "user");
      const text = firstUserMsg?.parts?.[0]?.type === "text" ? firstUserMsg.parts[0].text : "";
      fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: sid, firstMessage: text }),
      })
        .then((res) => res.json())
        .then(() => onSessionCreated(sid))
        .catch(() => {});
    }
  }, [agent.session, agent.data.messages.length]);

  // Generate title after first round completes
  useEffect(() => {
    const sid = agent.session?.sessionId;
    const userMsgs = agent.data.messages.filter((m) => m.role === "user");
    const assistantMsgs = agent.data.messages.filter((m) => m.role === "assistant");
    if (sid && !titleGeneratedRef.current && userMsgs.length > 0 && assistantMsgs.length > 0 && !isBusy) {
      titleGeneratedRef.current = true;
      const userText = userMsgs[0]?.parts?.[0]?.type === "text" ? userMsgs[0].parts[0].text : "";
      const assistantText = assistantMsgs[0]?.parts?.find((p) => p.type === "text")?.text || "";
      // Re-register with full context to update title
      fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: sid, firstMessage: userText, responseMessage: assistantText }),
      }).catch(() => {});
    }
  }, [agent.data.messages, agent.session?.sessionId, isBusy]);

  const handleSubmit = async (message: PromptInputMessage) => {
    const text = message.text.trim();
    if (!text || isBusy) return;
    await agent.send({ message: text });
  };

  const composer = (
    <PromptInput onSubmit={handleSubmit}>
      <PromptInputTextarea placeholder="发送消息…" />
      <PromptInputSubmit onStop={agent.stop} status={agent.status} />
    </PromptInput>
  );

  // Show loading state
  if (loadingHistory) {
    return (
      <main className="flex h-full flex-col items-center justify-center bg-background text-foreground">
        <div className="text-muted-foreground text-sm">加载会话中...</div>
      </main>
    );
  }

  return (
    <main className="flex h-full flex-col overflow-hidden bg-background text-foreground">
      {isEmpty ? null : (
        <header className="flex h-14 shrink-0 items-center justify-center gap-3 pl-4 pr-2">
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate text-muted-foreground text-sm">{AGENT_NAME}</span>
            <StatusDot status={agent.status} />
          </span>
        </header>
      )}

      {agent.error ? (
        <div className="mx-auto w-full max-w-3xl shrink-0 px-4 pt-2 sm:px-6">
          <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm">
            <AlertCircleIcon className="mt-0.5 size-4 shrink-0 text-destructive" />
            <div>
              <p className="font-medium">请求失败</p>
              <p className="mt-0.5 text-muted-foreground">{agent.error.message}</p>
            </div>
          </div>
        </div>
      ) : null}

      {isEmpty ? null : (
        <Conversation className="min-h-0 flex-1">
          <ConversationContent className="mx-auto w-full max-w-3xl gap-6 px-4 py-6 sm:px-6">
            {/* Show saved history messages */}
            {savedMessages.map((msg, i) => {
              // Support both old {role, text} and new {role, parts} formats
              const text = msg.parts
                ? msg.parts.filter((p) => p.type === "text").map((p) => p.text).join("")
                : (msg as any).text || "";
              if (!text) return null;
              return (
                <div key={`saved-${i}`} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
                  <div
                    className={cn(
                      "max-w-[80%] rounded-lg px-4 py-2 text-sm",
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted",
                    )}
                  >
                    <MessageResponse>{text}</MessageResponse>
                  </div>
                </div>
              );
            })}
            {/* Show live messages */}
            {agent.data.messages.map((message, index) => (
              <AgentMessage
                canRespond={!isBusy}
                isStreaming={
                  agent.status === "streaming" && index === agent.data.messages.length - 1
                }
                key={message.id}
                message={message}
                onInputResponses={(inputResponses) => agent.send({ inputResponses })}
              />
            ))}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>
      )}

      <div
        className={cn(
          "mx-auto w-full px-4 sm:px-6",
          isEmpty
            ? "flex max-w-xl flex-1 flex-col items-center justify-center gap-8 pb-[10vh]"
            : "max-w-3xl shrink-0 pb-6",
        )}
      >
        {isEmpty ? (
          <div className="flex flex-col items-center gap-3 text-center">
            <h1 className="font-medium text-5xl tracking-tighter">{AGENT_NAME}</h1>
          </div>
        ) : null}
        <div className="w-full">{composer}</div>
      </div>
    </main>
  );
}

function StatusDot({ status }: { readonly status: AgentStatus }) {
  const isLive = status === "submitted" || status === "streaming";
  const tone =
    status === "error"
      ? "bg-destructive"
      : isLive
        ? "bg-emerald-500"
        : status === "ready"
          ? "bg-muted-foreground"
          : "bg-muted-foreground/50";

  return (
    <span className="relative flex size-1">
      {isLive ? (
        <span
          className={cn(
            "absolute inline-flex size-full animate-ping rounded-full opacity-75",
            tone,
          )}
        />
      ) : null}
      <span className={cn("relative inline-flex size-1 rounded-full transition-colors", tone)} />
    </span>
  );
}
