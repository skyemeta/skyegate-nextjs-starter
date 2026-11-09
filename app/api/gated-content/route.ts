import { validateContentToken } from '@skyemeta/skyegate';

// jose pulls in node-only crypto APIs; force the Node runtime instead of edge.
export const runtime = 'nodejs';

// Match what the browser sent to /api/verify so a JWT earned for one route
// can't be replayed against a different gate.
const EXPECTED_CONDITIONS = [
  {
    type: 'token_balance' as const,
    contractAddress: 'native',
    chainId: 1,
    threshold: '0.000001',
    label: 'ETH ≥ 0.000001 on Ethereum mainnet',
  },
];

export async function POST(req: Request) {
  let body: { jwt?: string; receipt?: string; pqJwt?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body.jwt) {
    return Response.json({ error: 'Missing jwt' }, { status: 400 });
  }

  // pqJwt is the post-quantum companion of jwt. It is checked and reported as result.pq
  // (verified / refuted / absent / unverifiable); a refuted companion always fails. Set
  // pqRequiredFrom to your own cutoff date once you want an absent companion to fail too.
  // The receipt is Skye Meta's signed statement that this exact JWT came through your
  // licensed gate, for your domain, for a wallet whose owner signed the ownership challenge.
  // Without it, anyone could post a JWT requested directly from InsumerAPI for a holder's wallet.
  // audience = your site's domain as the browser reports it, without www. or a port. Set
  // SKYEGATE_SITE_DOMAIN in production; otherwise it is read from this request's address.
  const audience =
    process.env.SKYEGATE_SITE_DOMAIN ??
    new URL(req.url).hostname.toLowerCase().replace(/^www\./, '');
  const result = await validateContentToken(body.jwt, {
    receipt: body.receipt,
    audience,
    expectedConditions: EXPECTED_CONDITIONS,
    pqJwt: body.pqJwt,
  });

  if (!result.pass) {
    return Response.json({ error: result.error ?? 'Not authorized', pq: result.pq }, { status: 403 });
  }

  return Response.json({
    pq: result.pq,
    secret:
      'You unlocked this server-side. The text was never in the page source or the JS bundle: your server fetched it from /api/gated-content after the signed JWT and its receipt cleared validation.',
  });
}
