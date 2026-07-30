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
import { supabase } from "@/integrations/supabase/client";
import { useDebounce } from "@/hooks/useDebounce";

export function GlobalSearch({ open, setOpen }: { open: boolean; setOpen: (open: boolean) => void }) {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { canWriteTransactions, role } = useAuth();

  const [accounts, setAccounts] = useState<{ id: string; name: string; account_no: string }[]>([]);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);

  useEffect(() => {
    if (!open) {
      setAccounts([]);
      setSearch("");
      return;
    }

    let query = supabase.from("accounts").select("id, name, account_no");
    
    if (debouncedSearch) {
      const term = debouncedSearch.trim().replace(/\\/g, "\\\\").replace(/\*/g, "\\*");
      query = query.or(`name.ilike.*${term}*,account_no.ilike.*${term}*`);
    }
    
    query.limit(20).then((res) => {
      if (res.data) setAccounts(res.data);
    });
  }, [open, debouncedSearch]);

  const runCommand = (command: () => void) => {
    setOpen(false);
    command();
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen} shouldFilter={!debouncedSearch}>
      <CommandInput placeholder={t("SearchPlaceholder")} value={search} onValueChange={setSearch} />
      <CommandList>
        <CommandEmpty>{i18n.language === "ur" ? "کوئی نتیجہ نہیں ملا" : "No results found."}</CommandEmpty>
        
        <CommandGroup heading={t("Dashboard")}>
          <CommandItem onSelect={() => runCommand(() => navigate("/"))}>
            <LayoutDashboard className="mr-2 h-4 w-4" />
            <span>{t("Dashboard")}</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => navigate("/accounts"))}>
            <Users className="mr-2 h-4 w-4" />
            <span>{t("Accounts")}</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => navigate("/transactions"))}>
            <FileText className="mr-2 h-4 w-4" />
            <span>{t("Transactions")}</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => navigate("/settings"))}>
            <Settings className="mr-2 h-4 w-4" />
            <span>{t("Settings")}</span>
          </CommandItem>
        </CommandGroup>

        {accounts.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading={t("Accounts")}>
              {accounts.map((acc) => (
                <CommandItem key={acc.id} onSelect={() => runCommand(() => navigate(`/accounts/${acc.id}`))}>
                  <Users className="mr-2 h-4 w-4" />
                  <span>{acc.name} ({acc.account_no})</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {canWriteTransactions && (
          <>
            <CommandSeparator />
            <CommandGroup heading={t("Actions")}>
              <CommandItem onSelect={() => runCommand(() => navigate("/transactions/new"))}>
                <Plus className="mr-2 h-4 w-4" />
                <span>{t("NewTransaction")} (Ctrl+N)</span>
              </CommandItem>
              <CommandItem onSelect={() => runCommand(() => navigate("/accounts/new"))}>
                <Plus className="mr-2 h-4 w-4" />
                <span>{t("NewAccount")}</span>
              </CommandItem>
            </CommandGroup>
          </>
        )}

        {role === "admin" && (
          <>
            <CommandSeparator />
            <CommandGroup heading={t("AdminPanel")}>
              <CommandItem onSelect={() => runCommand(() => navigate("/branches"))}>
                <Building2 className="mr-2 h-4 w-4" />
                <span>{t("Branches")}</span>
              </CommandItem>
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
