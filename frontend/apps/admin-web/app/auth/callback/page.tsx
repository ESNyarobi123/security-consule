'use client';

import { getMe, getOidcConfig } from '@pssms/api-client';
import {
  clearOidcRefresh,
  defaultOidcRedirectUri,
  exchangeAuthorizationCode,
  setSession,
  storeOidcRefresh,
  takePkceSession,
} from '@pssms/auth';
import { defaultPortal } from '@pssms/permissions';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';

function CallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [message, setMessage] = useState('Completing SSO…');
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    async function run() {
      const errParam = searchParams.get('error');
      if (errParam) {
        const desc = searchParams.get('error_description') ?? errParam;
        router.replace(`/login?error=${encodeURIComponent(desc)}`);
        return;
      }

      const code = searchParams.get('code');
      const state = searchParams.get('state');
      if (!code || !state) {
        router.replace('/login?error=missing_code');
        return;
      }

      const pkce = takePkceSession();
      if (!pkce || pkce.state !== state) {
        router.replace('/login?error=state_mismatch');
        return;
      }

      try {
        const oidc = await getOidcConfig();
        if (!oidc.tokenEndpoint || !oidc.clients.adminWeb) {
          throw new Error('OIDC token endpoint not configured');
        }

        const tokens = await exchangeAuthorizationCode({
          tokenEndpoint: oidc.tokenEndpoint,
          clientId: oidc.clients.adminWeb,
          code,
          redirectUri: defaultOidcRedirectUri(),
          codeVerifier: pkce.verifier,
        });

        if (tokens.refresh_token) {
          storeOidcRefresh(tokens.refresh_token);
        } else {
          clearOidcRefresh();
        }

        const user = await getMe(tokens.access_token);
        setSession(tokens.access_token, user);
        setMessage('Signed in — redirecting…');
        router.replace(defaultPortal(user));
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : 'SSO callback failed';
        router.replace(`/login?error=${encodeURIComponent(msg.slice(0, 200))}`);
      }
    }

    void run();
  }, [router, searchParams]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <p className="text-sm text-slate-400">{message}</p>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-400">
          Completing SSO…
        </div>
      }
    >
      <CallbackInner />
    </Suspense>
  );
}
