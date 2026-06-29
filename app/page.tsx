"use client";

import { useCallback, useState } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { SessionSidebar } from "./_components/session-sidebar";
import { AgentChat } from "./_components/agent-chat";

export default function Page() {
  const [activeSessionId, setActiveSessionId] = useState<string | null>(() => {
    try {
      return localStorage.getItem("eve-active-session");
    } catch {
      return null;
    }
  });

  const [chatKey, setChatKey] = useState(0);

  const handleSessionSelect = useCallback((sessionId: string) => {
    setActiveSessionId(sessionId);
    try {
      localStorage.setItem("eve-active-session", sessionId);
    } catch {
      // ignore
    }
    setChatKey((k) => k + 1);
  }, []);

  const handleNewSession = useCallback(() => {
    setActiveSessionId(null);
    try {
      localStorage.removeItem("eve-active-session");
    } catch {
      // ignore
    }
    setChatKey((k) => k + 1);
  }, []);

  const handleSessionCreated = useCallback((sessionId: string) => {
    setActiveSessionId(sessionId);
    try {
      localStorage.setItem("eve-active-session", sessionId);
    } catch {
      // ignore
    }
  }, []);

  const handleDeleteSession = useCallback(
    (sessionId: string) => {
      try {
        localStorage.removeItem(`eve-session:${sessionId}`);
      } catch {
        // ignore
      }
      if (sessionId === activeSessionId) {
        handleNewSession();
      }
    },
    [activeSessionId, handleNewSession],
  );

  return (
    <SidebarProvider>
      <SessionSidebar
        activeSessionId={activeSessionId}
        onSessionSelect={handleSessionSelect}
        onNewSession={handleNewSession}
        onDeleteSession={handleDeleteSession}
      />
      <main className="flex h-dvh flex-1 flex-col overflow-hidden">
        <div className="flex items-center gap-2 px-4 pt-2 sm:hidden">
          <SidebarTrigger />
        </div>
        <AgentChat
          key={chatKey}
          activeSessionId={activeSessionId}
          onSessionCreated={handleSessionCreated}
        />
      </main>
    </SidebarProvider>
  );
}
