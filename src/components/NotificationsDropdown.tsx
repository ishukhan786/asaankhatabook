import { useState, useEffect } from "react";
import { Bell, Megaphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";

interface SystemNotice {
  id: string;
  title: string;
  message: string;
  created_at: string;
}

export function NotificationsDropdown() {
  const [notices, setNotices] = useState<SystemNotice[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hasNew, setHasNew] = useState(false);

  useEffect(() => {
    // Initial fetch to see if there are any notices and setup realtime
    fetchNotices();

    const channel = supabase.channel("system_notices_dropdown_live")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "system_notices" }, (payload) => {
        const newNotice = payload.new as SystemNotice;
        setNotices((prev) => [newNotice, ...prev]);
        setHasNew(true);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchNotices = async () => {
    setLoading(true);
    // @ts-expect-error - table might not be in types yet
    const { data, error } = await supabase
      .from("system_notices")
      .select("id, title, message, created_at")
      .order("created_at", { ascending: false })
      .limit(30);

    if (!error && data) {
      setNotices(data as SystemNotice[]);
    }
    setLoading(false);
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (newOpen) {
      setHasNew(false); // Clear the unread badge when opened
      fetchNotices(); // Refresh when opening just in case
    }
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative group">
          <Bell className="h-[1.2rem] w-[1.2rem] transition-all group-hover:scale-110" />
          {hasNew && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-destructive rounded-full border border-background animate-pulse" />
          )}
          <span className="sr-only">Notifications</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0 shadow-2xl rounded-xl border-border bg-background/95 backdrop-blur-xl z-[100]">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 bg-muted/20">
          <h4 className="font-semibold text-sm flex items-center gap-2">
            <Bell className="w-4 h-4 text-primary" />
            Notifications
          </h4>
        </div>
        
        <ScrollArea className="h-[350px]">
          {loading && notices.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground animate-pulse">
              Loading notices...
            </div>
          ) : notices.length > 0 ? (
            <div className="flex flex-col">
              {notices.map((notice, i) => (
                <div 
                  key={notice.id} 
                  className={`flex gap-3 p-4 hover:bg-muted/30 transition-colors ${i !== notices.length - 1 ? 'border-b border-border/40' : ''}`}
                >
                  <div className="mt-0.5 shrink-0">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                      <Megaphone className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 overflow-hidden">
                    <p className="text-sm font-medium leading-none text-foreground truncate">
                      {notice.title}
                    </p>
                    <p className="text-xs text-muted-foreground whitespace-pre-wrap break-words leading-relaxed">
                      {notice.message}
                    </p>
                    <span className="text-[10px] text-muted-foreground/60 mt-1 font-medium">
                      {formatDistanceToNow(new Date(notice.created_at), { addSuffix: true })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center flex flex-col items-center justify-center h-full">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
                <Bell className="w-6 h-6 text-muted-foreground/50" />
              </div>
              <p className="text-sm font-medium text-foreground">All caught up!</p>
              <p className="text-xs text-muted-foreground mt-1">No new notifications right now.</p>
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
