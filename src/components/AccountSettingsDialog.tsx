import { useEffect, useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabase';

export function AccountSettingsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [deletionText, setDeletionText] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !supabase) return;
    void supabase.auth.getUser().then(({ data }) => {
      setName(typeof data.user?.user_metadata.full_name === 'string' ? data.user.user_metadata.full_name : '');
      setEmail(data.user?.email ?? '');
      setDeletionText('');
    });
  }, [open]);

  const saveProfile = async () => {
    if (!supabase) return;
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ data: { full_name: name.trim() } });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success('Profile updated');
  };

  const deleteAccount = async () => {
    if (!supabase || deletionText !== 'DELETE') return;
    setBusy(true);
    const { error } = await supabase.functions.invoke('delete-account');
    if (error) {
      setBusy(false);
      return toast.error('Could not delete account. Please try again.');
    }
    await supabase.auth.signOut();
    setBusy(false);
    onOpenChange(false);
    toast.success('Account and saved data deleted');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Account settings</DialogTitle>
          <DialogDescription>{email}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Display name</Label>
            <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name" />
          </div>
          <Button onClick={saveProfile} disabled={busy} className="w-full">Save profile</Button>
        </div>
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-destructive"><AlertTriangle className="h-4 w-4" /> Delete account</div>
          <p className="text-xs text-muted-foreground">This permanently removes your account and cloud-saved Command Center and sales data.</p>
          <Input value={deletionText} onChange={(event) => setDeletionText(event.target.value)} placeholder="Type DELETE to confirm" />
          <Button variant="destructive" onClick={deleteAccount} disabled={busy || deletionText !== 'DELETE'} className="w-full gap-2">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Delete account
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
