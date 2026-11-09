'use client';

import { useEffect, useState } from 'react';
import { useAccount, useSignMessage } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { proveWalletOwnership } from '@skyemeta/skyegate';
import { GatedContent, type Condition } from '@skyemeta/skyegate/react';

// Default condition: any wallet holding at least 0.000001 ETH on mainnet.
// Swap this for any of the 4 condition types — see README for examples.
const CONDITIONS: Condition[] = [
  {
    type: 'token_balance',
    contractAddress: 'native',
    chainId: 1,
    threshold: '0.000001',
    label: 'ETH ≥ 0.000001 on Ethereum mainnet',
  },
];

export default function Home() {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [secret, setSecret] = useState<string | null>(null);
  const [pqStatus, setPqStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [proofError, setProofError] = useState<string | null>(null);

  // One free signature proves you control the address — the proxy requires
  // it for licensed EVM verifies. The token covers the whole visit.
  const [proof, setProof] = useState<string | undefined>();
  useEffect(() => {
    let cancelled = false;
    setProof(undefined);
    setProofError(null);
    if (!address) return;
    proveWalletOwnership({
      address,
      signMessage: (message) => signMessageAsync({ message }),
    }).then((r) => {
      if (cancelled) return;
      if (r.error) setProofError(r.error);
      setProof(r.proofToken ?? undefined);
    });
    return () => { cancelled = true; };
  }, [address, signMessageAsync]);

  async function handlePass(jwt: string, pqJwt?: string, receipt?: string) {
    setError(null);
    setSecret(null);
    setPqStatus(null);
    try {
      const res = await fetch('/api/gated-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jwt, receipt, pqJwt }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Request failed');
      setSecret(data.secret);
      setPqStatus(data.pq?.status ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch gated content');
    }
  }

  const licenseKey = process.env.NEXT_PUBLIC_SKYE_LICENSE_KEY;

  return (
    <main>
      <h1>SkyeGate Next.js Starter</h1>
      <p className="muted">
        Wallet-verified gated content using <code>@skyemeta/skyegate</code>. Powered by InsumerAPI.
      </p>

      <div className="row">
        <ConnectButton />
      </div>

      {!licenseKey || licenseKey === 'SKYE-XXXX-XXXX-XXXX' ? (
        <div className="gate-card fail">
          <h2>Set your license key</h2>
          <p className="muted">
            Copy <code>.env.local.example</code> to <code>.env.local</code> and set{' '}
            <code>NEXT_PUBLIC_SKYE_LICENSE_KEY</code> to your <code>SKYE-XXXX-XXXX-XXXX</code> key.
          </p>
          <p className="muted">
            Don&apos;t have one? <a href="https://skyemeta.com/skyegate/">Buy a SkyeGate Pro license</a> ($49/mo
            or $350/yr per domain — same key works on the WordPress plugin too).
          </p>
        </div>
      ) : !isConnected ? (
        <div className="gate-card">
          <h2>Connect a wallet</h2>
          <p className="muted">
            Click <strong>Connect Wallet</strong> above. The gate below verifies your wallet against
            the configured condition (default: at least 0.000001 ETH on Ethereum mainnet).
          </p>
        </div>
      ) : proofError ? (
        <div className="gate-card fail">
          <h2>Wallet signature needed</h2>
          <p className="muted">
            The gate needs one free signature to confirm you control this wallet. No transaction, no gas.
          </p>
          <p className="error">{proofError}</p>
        </div>
      ) : !proof ? (
        <div className="gate-card">
          <h2>Approve the signature in your wallet</h2>
          <p className="muted">
            One free signature confirms you control this wallet. No transaction, no gas.
          </p>
        </div>
      ) : (
        <GatedContent
          address={address}
          walletProof={proof}
          enabled={!!proof}
          conditions={CONDITIONS}
          licenseKey={licenseKey}
          loading={
            <div className="gate-card">
              <h2>Verifying…</h2>
              <p className="muted">Asking InsumerAPI to sign a yes-or-no on your wallet.</p>
            </div>
          }
          fallback={
            <div className="gate-card fail">
              <h2>Wallet did not meet the condition</h2>
              <p className="muted">
                Try a different wallet, or edit <code>CONDITIONS</code> in <code>app/page.tsx</code>.
                The default gates on ≥ 0.000001 ETH on Ethereum mainnet.
              </p>
            </div>
          }
          errorFallback={(message) => (
            <div className="gate-card fail">
              <h2>Couldn&apos;t check your wallet right now</h2>
              <p className="muted">
                This is not a &ldquo;no&rdquo;: the check did not come back. Try again in a moment.
              </p>
              <p className="error">{message}</p>
            </div>
          )}
          onPass={handlePass}
        >
          <div className="gate-card pass">
            <h2>Gate passed</h2>
            <p className="muted">
              The browser doesn&apos;t have the secret yet — your server is fetching it from{' '}
              <code>/api/gated-content</code> after validating the signed JWT.
            </p>
            {secret && (
              <div className="secret-box">
                <p style={{ marginBottom: 8, fontWeight: 600 }}>Secret content:</p>
                <p style={{ margin: 0 }}>{secret}</p>
                {pqStatus && (
                  <p className="muted" style={{ margin: '8px 0 0' }}>Post-quantum companion: {pqStatus}</p>
                )}
              </div>
            )}
            {error && <p className="error">{error}</p>}
          </div>
        </GatedContent>
      )}
    </main>
  );
}
