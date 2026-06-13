import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { User, Lock, Settings as SettingsIcon, Camera, Moon, Sun, Building2, FileText, Globe2, Download, LogOut, Loader } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useTranslation } from "react-i18next";

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
      const fileExt = file.name.split(".").pop();
      const filePath = `${user?.id}-${Math.random()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from("profiles")
        .upsert({ 
          id: user?.id,
          avatar_url: publicUrl 
        });

      if (updateError) throw updateError;
      
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
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div>
        <div className="text-xs uppercase tracking-wider text-muted-foreground">Preferences</div>
        <h1 className="font-display text-3xl md:text-4xl font-bold flex items-center gap-2">
          <SettingsIcon className="w-7 h-7 text-primary" /> Settings
        </h1>
        <p className="text-muted-foreground mt-1">Manage business identity, PDF defaults, app preferences, and account security.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="glass p-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Signed in as</div>
          <div className="mt-1 font-semibold truncate">{user?.email}</div>
        </Card>
        <Card className="glass p-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Role</div>
          <div className="mt-1 font-semibold capitalize">{role?.replace("_", " ") ?? "User"}</div>
        </Card>
        <Card className="glass p-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Default Currency</div>
          <div className="mt-1 font-semibold">{prefs.defaultCurrency}</div>
        </Card>
      </div>

      <div className="grid gap-8">
        {/* Profile Section */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 text-lg font-bold">
            <User className="w-5 h-5 text-primary" /> Profile Information
          </div>
          <Card className="glass p-6">
            <form onSubmit={updateProfile} className="space-y-4">
              <div className="flex flex-col md:flex-row gap-6 items-center">
                <div className="relative group">
                  <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center border-4 border-background shadow-lg overflow-hidden">
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
                  <label className="absolute bottom-0 right-0 p-2 rounded-full bg-primary text-primary-foreground shadow-lg hover:scale-110 transition-transform cursor-pointer">
                    <Camera className="w-4 h-4" />
                    <input type="file" className="hidden" accept="image/*" onChange={uploadAvatar} disabled={uploading} />
                  </label>
                </div>
                <div className="flex-1 space-y-4 w-full">
                  <div className="grid gap-1.5">
                    <Label htmlFor="email">Email Address</Label>
                    <Input id="email" value={user?.email} disabled className="bg-muted/50 cursor-not-allowed" />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="name">Full Name</Label>
                    <Input 
                      id="name" 
                      value={fullName} 
                      onChange={(e) => setFullName(e.target.value)} 
                      placeholder="Enter your full name" 
                    />
                  </div>
                </div>
              </div>
              <div className="flex justify-end pt-2">
                <Button type="submit" disabled={busy} className="gradient-primary text-primary-foreground">
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

        <Separator className="opacity-50" />

        {/* Business Section */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 text-lg font-bold">
            <Building2 className="w-5 h-5 text-primary" /> Business Information
          </div>
          <Card className="glass p-6">
            <form onSubmit={updateBusinessInfo} className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="grid gap-1.5">
                  <Label htmlFor="businessName">Business Name</Label>
                  <Input
                    id="businessName"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder="Your business name"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="businessPhone">Business Phone</Label>
                  <Input
                    id="businessPhone"
                    value={businessPhone}
                    onChange={(e) => setBusinessPhone(e.target.value)}
                    placeholder="+92 300 0000000"
                  />
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="businessAddress">Business Address</Label>
                <Input
                    id="businessAddress"
                    value={businessAddress}
                    onChange={(e) => setBusinessAddress(e.target.value)}
                    placeholder="Shop, market, city"
                  />
              </div>
              <div className="flex justify-end pt-2">
                <Button type="submit" disabled={busy} className="gradient-primary text-primary-foreground">
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

        <Separator className="opacity-50" />

        {/* PDF and Report Defaults */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 text-lg font-bold">
            <FileText className="w-5 h-5 text-primary" /> PDF & Report Defaults
          </div>
          <Card className="glass p-6 space-y-5">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="grid gap-1.5">
                <Label>Default Currency</Label>
                <Select value={prefs.defaultCurrency} onValueChange={(value: "PKR" | "AED") => setPrefs({ ...prefs, defaultCurrency: value })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PKR">PKR - Pakistani Rupee</SelectItem>
                    <SelectItem value="AED">AED - UAE Dirham</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Date Format</Label>
                <Select value={prefs.dateFormat} onValueChange={(value: AppPreferences["dateFormat"]) => setPrefs({ ...prefs, dateFormat: value })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dd MMM yyyy">01 Jun 2026</SelectItem>
                    <SelectItem value="yyyy-MM-dd">2026-06-01</SelectItem>
                    <SelectItem value="MM/dd/yyyy">06/01/2026</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-3">
              <div className="flex items-center justify-between gap-4 rounded-lg border border-border/60 p-3">
                <div>
                  <div className="font-medium">Show business header</div>
                  <div className="text-sm text-muted-foreground">Use business name, phone, and address on statements.</div>
                </div>
                <Switch checked={prefs.showBusinessHeader} onCheckedChange={(checked) => setPrefs({ ...prefs, showBusinessHeader: checked })} />
              </div>
              <div className="flex items-center justify-between gap-4 rounded-lg border border-border/60 p-3">
                <div>
                  <div className="font-medium">Show customer mobile</div>
                  <div className="text-sm text-muted-foreground">Include account mobile number in exported reports where available.</div>
                </div>
                <Switch checked={prefs.showAccountMobile} onCheckedChange={(checked) => setPrefs({ ...prefs, showAccountMobile: checked })} />
              </div>
              <div className="flex items-center justify-between gap-4 rounded-lg border border-border/60 p-3">
                <div>
                  <div className="font-medium">Show signature line</div>
                  <div className="text-sm text-muted-foreground">Reserve space for signature or stamp on printable statements.</div>
                </div>
                <Switch checked={prefs.showSignatureLine} onCheckedChange={(checked) => setPrefs({ ...prefs, showSignatureLine: checked })} />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={exportPreferences}><Download className="w-4 h-4 mr-2" /> Export Settings</Button>
              <Button type="button" onClick={savePreferences} className="gradient-primary text-primary-foreground">Save Preferences</Button>
            </div>
          </Card>
        </section>

        {/* Security Section */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 text-lg font-bold">
            <Lock className="w-5 h-5 text-primary" /> Account Security
          </div>
          <Card className="glass p-6">
            <form onSubmit={changePassword} className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="grid gap-1.5">
                  <Label htmlFor="pass">New Password</Label>
                  <Input 
                    id="pass" 
                    type="password" 
                    value={pass} 
                    onChange={(e) => setPass(e.target.value)} 
                    placeholder="********" 
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="cpass">Confirm New Password</Label>
                  <Input 
                    id="cpass" 
                    type="password" 
                    value={confirmPass} 
                    onChange={(e) => setConfirmPass(e.target.value)} 
                    placeholder="********" 
                  />
                </div>
              </div>
              <div className="flex justify-end pt-2">
                <Button type="submit" disabled={busy} variant="secondary">
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

        {/* Preferences Section */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 text-lg font-bold">
            <Globe2 className="w-5 h-5 text-primary" /> App Preferences
          </div>
          <Card className="glass p-6 space-y-5">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="grid gap-1.5">
                <Label>Language</Label>
                <Select value={prefs.language} onValueChange={(value: "en" | "ur") => setPrefs({ ...prefs, language: value })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="ur">Urdu / RTL</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Theme</Label>
                <Button 
                  variant="outline" 
                  className="justify-start"
                  onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                >
                  {theme === "dark" ? <Sun className="w-5 h-5 mr-2" /> : <Moon className="w-5 h-5 mr-2" />}
                  {theme === "dark" ? "Dark mode" : "Light mode"}
                </Button>
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border/60 p-3">
              <div className="space-y-0.5">
                <div className="font-medium">Local preferences</div>
                <div className="text-sm text-muted-foreground">Stored on this device for UI and export defaults.</div>
              </div>
              <Button type="button" variant="secondary" onClick={savePreferences}>Save</Button>
            </div>
          </Card>
        </section>

        <section className="space-y-4">
          <div className="flex items-center gap-2 text-lg font-bold">
            <LogOut className="w-5 h-5 text-primary" /> Session
          </div>
          <Card className="glass p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="font-medium">Sign out from this device</div>
              <div className="text-sm text-muted-foreground">Use this when switching users or leaving a shared computer.</div>
            </div>
            <Button type="button" variant="outline" onClick={signOut}>
              <LogOut className="w-4 h-4 mr-2" /> Sign Out
            </Button>
          </Card>
        </section>
      </div>
    </div>
  );
}
