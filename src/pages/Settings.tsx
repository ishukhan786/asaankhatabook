import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { User, Lock, Settings as SettingsIcon, Camera, Moon, Sun, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Separator } from "@/components/ui/separator";

export default function Settings() {
  const { theme, setTheme } = useTheme();
  const { profile, user, refresh } = useAuth();
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  // Profile state
  const [fullName, setFullName] = useState("");
  
  // Password state
  const [pass, setPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");

  useEffect(() => {
    if (profile) setFullName(profile.full_name || "");
  }, [profile]);

  const updateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) return;
    setBusy(true);
    try {
      const { error } = await supabase.from("profiles").update({
        full_name: fullName.trim()
      }).eq("id", user?.id);
      
      if (error) throw error;
      toast.success("Profile updated successfully");
      await refresh();
    } catch (err: any) { toast.error(err.message); }
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
        .update({ avatar_url: publicUrl })
        .eq("id", user?.id);

      if (updateError) throw updateError;
      
      toast.success("Avatar updated");
      await refresh();
    } catch (err: any) {
      toast.error(err.message);
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
    } catch (err: any) { toast.error(err.message); }
    setBusy(false);
  };

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div>
        <div className="text-xs uppercase tracking-wider text-muted-foreground">Preferences</div>
        <h1 className="font-display text-3xl md:text-4xl font-bold flex items-center gap-2">
          <SettingsIcon className="w-7 h-7 text-primary" /> Settings
        </h1>
        <p className="text-muted-foreground mt-1">Manage your profile and account security.</p>
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
                      <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
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
                  Save Changes
                </Button>
              </div>
            </form>
          </Card>
        </section>

        <Separator className="opacity-50" />

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
                    placeholder="••••••••" 
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="cpass">Confirm New Password</Label>
                  <Input 
                    id="cpass" 
                    type="password" 
                    value={confirmPass} 
                    onChange={(e) => setConfirmPass(e.target.value)} 
                    placeholder="••••••••" 
                  />
                </div>
              </div>
              <div className="flex justify-end pt-2">
                <Button type="submit" disabled={busy} variant="secondary">
                  Update Password
                </Button>
              </div>
            </form>
          </Card>
        </section>

        {/* Preferences Section */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 text-lg font-bold">
            <Sun className="w-5 h-5 text-primary" /> App Preferences
          </div>
          <Card className="glass p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="font-medium">Theme Mode</div>
                <div className="text-sm text-muted-foreground">Switch between light and dark themes.</div>
              </div>
              <Button 
                variant="outline" 
                size="icon" 
                className="rounded-full h-10 w-10"
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              >
                {theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </Button>
            </div>
          </Card>
        </section>
      </div>
    </div>
  );
}
