import { useEffect, useState } from 'react';
import { Mail, Loader2, Chrome } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/supabase';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SupabaseAuthDialog({ open, onOpenChange }: Props) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState<'email' | 'google' | null>(null);

  useEffect(() => {
    if (!open) setLoading(null);
  }, [open]);

  const sendMagicLink = async () => {
    if (!supabase) return toast.error('Supabase is not configured');
    if (!/^\S+@\S+\.\S+$/.test(email)) return toast.error('Enter a valid email address');
    setLoading('email');
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin },
    });
    setLoading(null);
    if (error) return toast.error(error.message);
    toast.success('Check your email for a secure sign-in link');
  };

  const signInWithGoogle = async () => {
    if (!supabase) return toast.error('Supabase is not configured');
    setLoading('google');
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    if (error) {
      setLoading(null);
      toast.error(error.message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Save your work across devices</DialogTitle>
          <DialogDescription>
            Sign in to keep new Command Center changes attached to your account instead of this browser only.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          <Button variant="outline" className="w-full gap-2" onClick={signInWithGoogle} disabled={loading !== null}>
            {loading === 'google' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Chrome className="h-4 w-4" />}
            Continue with Google
          </Button>
          <div className="relative py-1 text-center text-[11px] text-muted-foreground before:absolute before:inset-x-0 before:top-1/2 before:border-t before:border-border">
            <span className="relative bg-background px-2">or</span>
          </div>
          <div className="flex gap-2">
            <Input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              onKeyDown={(event) => { if (event.key === 'Enter') void sendMagicLink(); }}
              placeholder="you@example.com"
              autoComplete="email"
            />
            <Button onClick={sendMagicLink} disabled={loading !== null} className="gap-1.5 shrink-0">
              {loading === 'email' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
              Email link
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
