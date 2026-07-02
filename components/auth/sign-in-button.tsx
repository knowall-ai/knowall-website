'use client';

import { useState } from 'react';
import { ChevronDown, ExternalLink, LogOut, Puzzle, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useNostrAuth, type NostrUser } from '@/components/auth/nostr-auth-provider';
import { cn } from '@/lib/utils';

// Recommended NIP-07 extensions, linked from the sign-in dialog for
// visitors who don't have one installed yet.
const EXTENSIONS = [
  { name: 'Alby', href: 'https://getalby.com' },
  { name: 'nos2x', href: 'https://github.com/fiatjaf/nos2x' },
];

/** "npub1abcd…wxyz" — short enough for the header, still recognisable. */
function truncateNpub(npub: string): string {
  return `${npub.slice(0, 9)}…${npub.slice(-4)}`;
}

function displayName(user: NostrUser): string {
  return user.profile?.name ?? truncateNpub(user.npub);
}

/**
 * Header auth control (desktop + mobile menu), UX modeled on Robotechy's
 * LoginArea/AccountSwitcher. Signed out it shows a lime "Sign In" button that
 * opens an explainer dialog with a NIP-07 extension sign-in action; signed in
 * it shows the user's avatar and name with a profile/sign-out dropdown.
 */
export default function SignInButton({ className }: { className?: string }) {
  const { user, signIn, signOut } = useNostrAuth();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleOpenChange = (open: boolean) => {
    setIsDialogOpen(open);
    if (open) setError(null);
  };

  const handleExtensionSignIn = async () => {
    setIsSigningIn(true);
    setError(null);
    try {
      await signIn();
      setIsDialogOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed. Please try again.');
    } finally {
      setIsSigningIn(false);
    }
  };

  if (user) {
    const name = displayName(user);
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            data-testid="nostr-account-menu"
            className={cn(
              'flex items-center gap-2 rounded-full py-1 pl-1 pr-2 text-gray-300 transition-colors hover:bg-gray-800 hover:text-lime-500',
              className
            )}
          >
            <Avatar className="h-8 w-8">
              <AvatarImage src={user.profile?.picture} alt={name} />
              <AvatarFallback className="bg-lime-600 text-sm font-semibold text-white">
                {name.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="max-w-[10rem] truncate text-sm font-medium">{name}</span>
            <ChevronDown className="h-4 w-4" aria-hidden="true" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem asChild className="cursor-pointer">
            <a href={`https://njump.me/${user.npub}`} target="_blank" rel="noopener noreferrer">
              <User className="mr-2 h-4 w-4" aria-hidden="true" />
              <span>View profile</span>
              <ExternalLink className="ml-auto h-3 w-3 text-muted-foreground" aria-hidden="true" />
            </a>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={signOut} className="cursor-pointer text-red-500">
            <LogOut className="mr-2 h-4 w-4" aria-hidden="true" />
            <span>Sign out</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <>
      <Button
        onClick={() => handleOpenChange(true)}
        className={cn('bg-lime-600 text-white hover:bg-lime-700', className)}
      >
        Sign In
      </Button>

      <Dialog open={isDialogOpen} onOpenChange={handleOpenChange}>
        <DialogContent className="border-gray-800 bg-gray-900 text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">Sign in with Nostr</DialogTitle>
            <DialogDescription className="text-gray-400">
              KnowAll AI uses Nostr — an open protocol where you own your identity. No passwords, no
              accounts to create: sign in with the same key you use across the Nostr network.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {error && (
              <p role="alert" className="text-center text-sm text-red-400">
                {error}
              </p>
            )}

            <Button
              onClick={handleExtensionSignIn}
              disabled={isSigningIn}
              className="w-full bg-lime-600 font-semibold text-white hover:bg-lime-700"
            >
              <Puzzle className="mr-2 h-4 w-4" aria-hidden="true" />
              {isSigningIn ? 'Waiting for extension...' : 'Sign in with extension'}
            </Button>

            <p className="text-center text-xs text-gray-400">
              Requires a NIP-07 browser extension. Don&apos;t have one? Try{' '}
              {EXTENSIONS.map((extension, index) => (
                <span key={extension.name}>
                  {index > 0 && ' or '}
                  <a
                    href={extension.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-lime-500 underline-offset-4 hover:underline"
                  >
                    {extension.name}
                  </a>
                </span>
              ))}
              .
            </p>

            <p className="border-t border-gray-800 pt-3 text-center text-xs text-gray-500">
              Signing in with a secret key (nsec) or a remote signer (bunker) is coming soon.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
