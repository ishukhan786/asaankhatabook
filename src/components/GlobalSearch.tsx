import { useEffect, useState } from "react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { useNavigate } from "react-router-dom";
import { Search, Plus, Users, FileText, Building2, LayoutDashboard, Settings } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/useAuth";

export function GlobalSearch({ open, setOpen }: { open: boolean; setOpen: (open: boolean) => void }) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { canWriteTransactions, role } = useAuth();

  const runCommand = (command: () => void) => {
    setOpen(false);
    command();
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        
        <CommandGroup heading="Navigation">
          <CommandItem onSelect={() => runCommand(() => navigate("/"))}>
            <LayoutDashboard className="mr-2 h-4 w-4" />
            <span>Dashboard</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => navigate("/accounts"))}>
            <Users className="mr-2 h-4 w-4" />
            <span>Accounts</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => navigate("/transactions"))}>
            <FileText className="mr-2 h-4 w-4" />
            <span>Transactions</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => navigate("/settings"))}>
            <Settings className="mr-2 h-4 w-4" />
            <span>Settings</span>
          </CommandItem>
        </CommandGroup>

        {canWriteTransactions && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Actions">
              <CommandItem onSelect={() => runCommand(() => navigate("/transactions/new"))}>
                <Plus className="mr-2 h-4 w-4" />
                <span>New Transaction (Ctrl+N)</span>
              </CommandItem>
              <CommandItem onSelect={() => runCommand(() => navigate("/accounts/new"))}>
                <Plus className="mr-2 h-4 w-4" />
                <span>New Account</span>
              </CommandItem>
            </CommandGroup>
          </>
        )}

        {role === "admin" && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Admin">
              <CommandItem onSelect={() => runCommand(() => navigate("/branches"))}>
                <Building2 className="mr-2 h-4 w-4" />
                <span>Manage Branches</span>
              </CommandItem>
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
