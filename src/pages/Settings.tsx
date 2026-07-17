import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { User, Lock, Settings as SettingsIcon, Camera, Moon, Sun, Building2, FileText, Globe2, Download, LogOut, Loader, Shield } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useTranslation } from "react-i18next";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/PageHeader";

interface ClerkWindow extends Window {
  Clerk?: { session?: { getToken: () => Promise<string | null> } };
}

type AppPreferences = {
  defaultCurrency: "PKR" | "AED";
  dateFormat: "dd MMM yyyy" | "yyyy-MM-dd" | "MM/dd/yyyy";
  language: "en" | "ur";
  showBusinessHeader: boolean;
  showSignatureLine: boolean;
  showAccountMobile: boolean;
};

const defaultPreferences: AppPreferences = {
  defaultCurrency: "PKR",
  dateFormat: "dd MMM yyyy",
  language: "en",
  showBusinessHeader: true,
  showSignatureLine: true,
  showAccountMobile: true,
};

const loadPreferences = (): AppPreferences => {
  try {
    const raw = localStorage.getItem("asaankhata.preferences");
    return raw ? { ...defaultPreferences, ...JSON.parse(raw) } : defaultPreferences;
  } catch {
    return defaultPreferences;
  }
};

export default function Settings() {
  const { theme, setTheme } = useTheme();
  const { profile, user, refresh, role, signOut } = useAuth();
  const { i18n } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [prefs, setPrefs] = useState<AppPreferences>(() => loadPreferences());
  
  // Profile state
  const [fullName, setFullName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [businessPhone, setBusinessPhone] = useState("");
  const [businessAddress, setBusinessAddress] = useState("");
  
  // Password state
  const [pass, setPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || "");
      setBusinessName(profile.business_name || "");
      setBusinessPhone(profile.business_phone || "");
      setBusinessAddress(profile.business_address || "");
    }
  }, [profile]);

  useEffect(() => {
    i18n.changeLanguage(prefs.language);
    document.documentElement.dir = prefs.language === "ur" ? "rtl" : "ltr";
  }, [i18n, prefs.language]);

  const updateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) return;
    setBusy(true);
    try {
      const { error } = await supabase.from("profiles").update({
        full_name: fullName.trim(),
      }).eq("id", user?.id);
      
      if (error) throw error;
      toast.success("Profile updated successfully");
      await refresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error(message);
    }
    setBusy(false);
  };

  const updateBusinessInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.from("profiles").upsert({
        id: user?.id,
        business_name: businessName.trim() || null,
        business_phone: businessPhone.trim() || null,
        business_address: businessAddress.trim() || null,
      });

      if (error) throw error;
      toast.success("Business information updated");
      await refresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error(message);
    }
    setBusy(false);
  };

  const uploadAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);
      if (!e.target.files || e.target.files.length === 0) throw new Error("Select an image to upload");
      
      const file = e.target.files[0];
      
      // Use Edge Function for upload (bypasses Clerk JWT + Storage RLS issue)
      const fnUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/upload-avatar`;
      
      // Get Clerk token
      const clerkToken = typeof window !== 'undefined' && (window as ClerkWindow).Clerk?.session
        ? await (window as ClerkWindow).Clerk!.session!.getToken()
        : null;

      if (!clerkToken) throw new Error("Not authenticated");

      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(fnUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${clerkToken}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed");

      toast.success("Avatar updated");
      await refresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error(message);
    } finally {
      setUploading(false);
    }
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pass !== confirmPass) { toast.error("Passwords do not match"); return; }
    if (pass.length < 6) { toast.error("Password must be at least 6 characters"); return; }
    
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pass });
      if (error) throw error;
      toast.success("Password changed successfully");
      setPass("");
      setConfirmPass("");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error(message);
    }
    setBusy(false);
  };

  const savePreferences = () => {
    localStorage.setItem("asaankhata.preferences", JSON.stringify(prefs));
    toast.success("Preferences saved");
  };

  const exportPreferences = () => {
    const payload = {
      exported_at: new Date().toISOString(),
      profile: {
        full_name: fullName,
        business_name: businessName,
        business_phone: businessPhone,
        business_address: businessAddress,
      },
      preferences: prefs,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "asaankhata-settings.json";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-8    ">
      <PageHeader
        eyebrow="Preferences"
        title={<span className="flex items-center gap-2"><SettingsIcon className="w-7 h-7 text-primary" /> Settings</span>}
        description="Manage your identity, business details, app preferences, and security."
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="glass p-4 border-l-4 border-l-primary flex items-center gap-4">
          <div className="bg-primary/10 p-3 rounded-full">
            <User className="w-5 h-5 text-primary" />
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Signed in as</div>
            <div className="mt-1 font-semibold truncate text-sm">{user?.email}</div>
          </div>
        </Card>
        <Card className="glass p-4 border-l-4 border-l-secondary flex items-center gap-4">
          <div className="bg-secondary/10 p-3 rounded-full">
            <Shield className="w-5 h-5 text-secondary-foreground" />
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Role</div>
            <div className="mt-1 font-semibold capitalize text-sm">{role?.replace("_", " ") ?? "User"}</div>
          </div>
        </Card>
        <Card className="glass p-4 border-l-4 border-l-accent flex items-center gap-4">
           <div className="bg-accent/10 p-3 rounded-full">
            <Globe2 className="w-5 h-5 text-accent-foreground" />
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Default Currency</div>
            <div className="mt-1 font-semibold text-sm">{prefs.defaultCurrency}</div>
          </div>
        </Card>
      </div>

      <Tabs defaultValue="profile" className="flex flex-col md:flex-row gap-6 lg:gap-10">
        <TabsList className="flex flex-row md:flex-col justify-start items-stretch h-auto bg-transparent space-x-2 md:space-x-0 md:space-y-2 w-full md:w-64 p-0 overflow-x-auto pb-2 md:pb-0">
          <TabsTrigger value="profile" className="justify-start px-4 py-3 data-[state=active]:bg-primary/10 data-[state=active]:text-primary transition-all rounded-lg text-left whitespace-nowrap md:whitespace-normal">
            <User className="w-4 h-4 mr-3" /> Profile
          </TabsTrigger>
          <TabsTrigger value="business" className="justify-start px-4 py-3 data-[state=active]:bg-primary/10 data-[state=active]:text-primary transition-all rounded-lg text-left whitespace-nowrap md:whitespace-normal">
            <Building2 className="w-4 h-4 mr-3" /> Business
          </TabsTrigger>
          <TabsTrigger value="preferences" className="justify-start px-4 py-3 data-[state=active]:bg-primary/10 data-[state=active]:text-primary transition-all rounded-lg text-left whitespace-nowrap md:whitespace-normal">
            <Globe2 className="w-4 h-4 mr-3" /> Preferences
          </TabsTrigger>
          <TabsTrigger value="security" className="justify-start px-4 py-3 data-[state=active]:bg-primary/10 data-[state=active]:text-primary transition-all rounded-lg text-left whitespace-nowrap md:whitespace-normal">
            <Lock className="w-4 h-4 mr-3" /> Security
          </TabsTrigger>
        </TabsList>

        <div className="flex-1 min-w-0">
          <TabsContent value="profile" className="mt-0 space-y-6 outline-none focus-visible:ring-0">
            <section className="space-y-4">
              <div className="flex items-center gap-2 text-lg font-bold border-b pb-2">
                Profile Information
              </div>
              <Card className="glass p-6">
                <form onSubmit={updateProfile} className="space-y-6">
                  <div className="flex flex-col md:flex-row gap-6 md:gap-10 items-center md:items-start">
                    <div className="relative group shrink-0">
                      <div className="w-28 h-28 rounded-full bg-muted flex items-center justify-center border-4 border-background shadow-xl overflow-hidden transition-all  group-hover:shadow-primary/20">
                        {profile?.avatar_url ? (
                          <img 
                            src={`${profile.avatar_url}`} 
                            alt="Avatar" 
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        ) : (
                          <User className="w-12 h-12 text-muted-foreground" />
                        )}
                        {uploading && (
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                            <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          </div>
                        )}
                      </div>
                      <label className="absolute bottom-1 right-1 p-2.5 rounded-full bg-primary text-primary-foreground shadow-lg hover:scale-110 transition-transform cursor-pointer ring-4 ring-background">
                        <Camera className="w-4 h-4" />
                        <input type="file" className="hidden" accept="image/*" onChange={uploadAvatar} disabled={uploading} />
                      </label>
                    </div>
                    <div className="flex-1 space-y-4 w-full">
                      <div className="grid gap-2">
                        <Label htmlFor="email" className="text-muted-foreground">Email Address</Label>
                        <Input id="email" value={user?.email} disabled className="bg-muted/50 cursor-not-allowed font-medium" />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="name" className="text-muted-foreground">Full Name</Label>
                        <Input 
                          id="name" 
                          value={fullName} 
                          onChange={(e) => setFullName(e.target.value)} 
                          placeholder="Enter your full name" 
                          className="font-medium"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-end pt-4 border-t border-border/50">
                    <Button type="submit" disabled={busy} className="gradient-primary text-primary-foreground min-w-[140px] shadow-lg shadow-primary/20">
                      {busy ? (
                        <>
                          <Loader className="w-4 h-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        "Save Changes"
                      )}
                    </Button>
                  </div>
                </form>
              </Card>
            </section>
          </TabsContent>

          <TabsContent value="business" className="mt-0 space-y-6 outline-none focus-visible:ring-0">
            <section className="space-y-4">
              <div className="flex items-center gap-2 text-lg font-bold border-b pb-2">
                Business Details
              </div>
              <Card className="glass p-6">
                <form onSubmit={updateBusinessInfo} className="space-y-5">
                  <div className="grid md:grid-cols-2 gap-5">
                    <div className="grid gap-2">
                      <Label htmlFor="businessName" className="text-muted-foreground">Business Name</Label>
                      <Input
                        id="businessName"
                        value={businessName}
                        onChange={(e) => setBusinessName(e.target.value)}
                        placeholder="Your business name"
                        className="font-medium"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="businessPhone" className="text-muted-foreground">Business Phone</Label>
                      <Input
                        id="businessPhone"
                        value={businessPhone}
                        onChange={(e) => setBusinessPhone(e.target.value)}
                        placeholder="+92 300 0000000"
                        className="font-medium"
                      />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="businessAddress" className="text-muted-foreground">Business Address</Label>
                    <Input
                        id="businessAddress"
                        value={businessAddress}
                        onChange={(e) => setBusinessAddress(e.target.value)}
                        placeholder="Shop, market, city"
                        className="font-medium"
                      />
                  </div>
                  <div className="flex justify-end pt-4 border-t border-border/50">
                    <Button type="submit" disabled={busy} className="gradient-primary text-primary-foreground min-w-[160px] shadow-lg shadow-primary/20">
                      {busy ? (
                        <>
                          <Loader className="w-4 h-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        "Save Business Info"
                      )}
                    </Button>
                  </div>
                </form>
              </Card>
            </section>
          </TabsContent>

          <TabsContent value="preferences" className="mt-0 space-y-6 outline-none focus-visible:ring-0">
            <section className="space-y-6">
              <div>
                <div className="flex items-center gap-2 text-lg font-bold border-b pb-2">
                  General Preferences
                </div>
                <Card className="glass p-6 mt-4 space-y-5">
                  <div className="grid md:grid-cols-2 gap-5">
                    <div className="grid gap-2">
                      <Label className="text-muted-foreground">Language</Label>
                      <Select value={prefs.language} onValueChange={(value: "en" | "ur") => setPrefs({ ...prefs, language: value })}>
                        <SelectTrigger className="font-medium"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="en">English</SelectItem>
                          <SelectItem value="ur">Urdu / RTL</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label className="text-muted-foreground">Theme</Label>
                      <Button 
                        variant="outline" 
                        className="justify-start font-medium"
                        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                      >
                        {theme === "dark" ? <Sun className="w-4 h-4 mr-2" /> : <Moon className="w-4 h-4 mr-2" />}
                        {theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/20 p-4">
                    <div className="space-y-1">
                      <div className="font-semibold">Local Preferences</div>
                      <div className="text-sm text-muted-foreground">Save your UI preferences locally on this device.</div>
                    </div>
                    <Button type="button" variant="secondary" onClick={savePreferences}>Save</Button>
                  </div>
                </Card>
              </div>

              <div>
                <div className="flex items-center gap-2 text-lg font-bold border-b pb-2">
                  PDF & Report Defaults
                </div>
                <Card className="glass p-6 mt-4 space-y-5">
                  <div className="grid md:grid-cols-2 gap-5">
                    <div className="grid gap-2">
                      <Label className="text-muted-foreground">Default Currency</Label>
                      <Select value={prefs.defaultCurrency} onValueChange={(value: "PKR" | "AED") => setPrefs({ ...prefs, defaultCurrency: value })}>
                        <SelectTrigger className="font-medium"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="PKR">PKR - Pakistani Rupee</SelectItem>
                          <SelectItem value="AED">AED - UAE Dirham</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label className="text-muted-foreground">Date Format</Label>
                      <Select value={prefs.dateFormat} onValueChange={(value: AppPreferences["dateFormat"]) => setPrefs({ ...prefs, dateFormat: value })}>
                        <SelectTrigger className="font-medium"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="dd MMM yyyy">01 Jun 2026</SelectItem>
                          <SelectItem value="yyyy-MM-dd">2026-06-01</SelectItem>
                          <SelectItem value="MM/dd/yyyy">06/01/2026</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid gap-3 pt-2">
                    <div className="flex items-center justify-between gap-4 rounded-xl border border-border/60 bg-muted/10 p-4 transition-colors hover:bg-muted/20">
                      <div>
                        <div className="font-semibold">Show business header</div>
                        <div className="text-sm text-muted-foreground">Use business name, phone, and address on statements.</div>
                      </div>
                      <Switch checked={prefs.showBusinessHeader} onCheckedChange={(checked) => setPrefs({ ...prefs, showBusinessHeader: checked })} />
                    </div>
                    <div className="flex items-center justify-between gap-4 rounded-xl border border-border/60 bg-muted/10 p-4 transition-colors hover:bg-muted/20">
                      <div>
                        <div className="font-semibold">Show customer mobile</div>
                        <div className="text-sm text-muted-foreground">Include account mobile number in exported reports where available.</div>
                      </div>
                      <Switch checked={prefs.showAccountMobile} onCheckedChange={(checked) => setPrefs({ ...prefs, showAccountMobile: checked })} />
                    </div>
                    <div className="flex items-center justify-between gap-4 rounded-xl border border-border/60 bg-muted/10 p-4 transition-colors hover:bg-muted/20">
                      <div>
                        <div className="font-semibold">Show signature line</div>
                        <div className="text-sm text-muted-foreground">Reserve space for signature or stamp on printable statements.</div>
                      </div>
                      <Switch checked={prefs.showSignatureLine} onCheckedChange={(checked) => setPrefs({ ...prefs, showSignatureLine: checked })} />
                    </div>
                  </div>
                  <div className="flex justify-end gap-3 pt-4 border-t border-border/50">
                    <Button type="button" variant="outline" onClick={exportPreferences}>
                      <Download className="w-4 h-4 mr-2" /> Export Settings
                    </Button>
                    <Button type="button" onClick={savePreferences} className="gradient-primary text-primary-foreground shadow-lg shadow-primary/20">
                      Save PDF Preferences
                    </Button>
                  </div>
                </Card>
              </div>
            </section>
          </TabsContent>

          <TabsContent value="security" className="mt-0 space-y-6 outline-none focus-visible:ring-0">
            <section className="space-y-4">
              <div className="flex items-center gap-2 text-lg font-bold border-b pb-2">
                Account Security
              </div>
              <Card className="glass p-6">
                <form onSubmit={changePassword} className="space-y-5">
                  <div className="grid md:grid-cols-2 gap-5">
                    <div className="grid gap-2">
                      <Label htmlFor="pass" className="text-muted-foreground">New Password</Label>
                      <Input 
                        id="pass" 
                        type="password" 
                        value={pass} 
                        onChange={(e) => setPass(e.target.value)} 
                        placeholder="********" 
                        className="font-medium"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="cpass" className="text-muted-foreground">Confirm New Password</Label>
                      <Input 
                        id="cpass" 
                        type="password" 
                        value={confirmPass} 
                        onChange={(e) => setConfirmPass(e.target.value)} 
                        placeholder="********" 
                        className="font-medium"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end pt-4 border-t border-border/50">
                    <Button type="submit" disabled={busy} variant="secondary" className="min-w-[160px]">
                      {busy ? (
                        <>
                          <Loader className="w-4 h-4 mr-2 animate-spin" />
                          Updating...
                        </>
                      ) : (
                        "Update Password"
                      )}
                    </Button>
                  </div>
                </form>
              </Card>
            </section>

            <section className="space-y-4 pt-4">
              <div className="flex items-center gap-2 text-lg font-bold border-b pb-2 text-destructive">
                Session Management
              </div>
              <Card className="border-destructive/20 bg-destructive/5 p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="font-bold text-destructive">Sign out from this device</div>
                  <div className="text-sm text-destructive/80 mt-1">Use this when switching users or leaving a shared computer.</div>
                </div>
                <Button type="button" variant="destructive" onClick={signOut} className="shadow-lg shadow-destructive/20">
                  <LogOut className="w-4 h-4 mr-2" /> Sign Out
                </Button>
              </Card>
            </section>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
