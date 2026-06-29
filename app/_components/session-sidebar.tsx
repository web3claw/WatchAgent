"use client";

import { useEffect, useState } from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { PlusIcon, TrashIcon, MessageSquareIcon } from "lucide-react";

interface Session {
  sessionId: string;
  title: string;
  createdAt: number;
  lastActivityAt: number;
}

function formatTime(ts: number): string {
  if (!ts) return "";
  const d = new Date(ts);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "刚刚";
  if (diffMin < 60) return `${diffMin}分钟前`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}小时前`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 7) return `${diffDay}天前`;
  return d.toLocaleDateString("zh-CN");
}

export function SessionSidebar({
  activeSessionId,
  refreshKey,
  onSessionSelect,
  onNewSession,
  onDeleteSession,
}: {
  activeSessionId: string | null;
  refreshKey: number;
  onSessionSelect: (sessionId: string) => void;
  onNewSession: () => void;
  onDeleteSession: (sessionId: string) => void;
}) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSessions = async () => {
    try {
      const res = await fetch("/api/sessions");
      const data = await res.json();
      setSessions(data.sessions || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, [refreshKey]);

  const handleDelete = async (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    try {
      await fetch(`/api/sessions/${sessionId}`, { method: "DELETE" });
      setSessions((prev) => prev.filter((s) => s.sessionId !== sessionId));
      onDeleteSession(sessionId);
    } catch {
      // ignore
    }
  };

  return (
    <Sidebar>
      <SidebarHeader className="flex flex-row items-center justify-between p-4">
        <span className="font-semibold text-sm">会话列表</span>
        <Button size="sm" variant="outline" onClick={onNewSession}>
          <PlusIcon className="size-4 mr-1" />
          新建
        </Button>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            {loading ? (
              <div className="px-4 py-2 text-muted-foreground text-sm">加载中...</div>
            ) : sessions.length === 0 ? (
              <div className="px-4 py-2 text-muted-foreground text-sm">暂无会话</div>
            ) : (
              <SidebarMenu>
                {sessions.map((session) => (
                  <SidebarMenuItem key={session.sessionId} className="group">
                    <SidebarMenuButton
                      isActive={session.sessionId === activeSessionId}
                      onClick={() => onSessionSelect(session.sessionId)}
                      className="w-full justify-start gap-2"
                    >
                      <MessageSquareIcon className="size-4 shrink-0" />
                      <div className="min-w-0 flex-1 text-left">
                        <div className="truncate text-sm">{session.title}</div>
                        <div className="truncate text-xs text-muted-foreground">
                          {formatTime(session.lastActivityAt || session.createdAt)}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        className="shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                        onClick={(e) => handleDelete(e, session.sessionId)}
                      >
                        <TrashIcon className="size-3" />
                      </Button>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            )}
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
