// Scheduled Amazon order sync backs off while Amazon keeps rejecting the credentials (FIX-136).
// During the 2026-10-14 → 22 outage every 15-minute run added a FAILED job (1,100+); a credential
// error does not fix itself, so wait longer after each one. Manual "Sync orders now" is never blocked.

const BASE_MINUTES = 15;
const MAX_MINUTES = 360;

// Messages of credential failures from the LWA token call (amazon-lwa-token.service.ts), old and new wording
const CREDENTIAL_FAILURE = /rejected the configured credentials|invalid_client|invalid_grant|authorization is invalid or has expired/i;

export const isCredentialFailure = (errorMessage: string | null | undefined) =>
  Boolean(errorMessage && CREDENTIAL_FAILURE.test(errorMessage));

export type BackoffJob = { status: string; errorMessage: string | null; createdAt: Date };

/**
 * jobs: latest finished order import jobs for one seller scope, newest first.
 * Skip when the newest N in a row are credential failures and the last one is younger than
 * 15 · 2^(N-1) minutes (capped at 6 hours). Any success or other error resets the streak.
 */
export const credentialBackoff = (jobs: BackoffJob[], now: Date) => {
  let streak = 0;
  for (const job of jobs) {
    if (job.status === 'FAILED' && isCredentialFailure(job.errorMessage)) streak += 1;
    else break;
  }
  const latest = jobs[0];
  if (streak === 0 || !latest) return { skip: false as const, streak };
  const waitMinutes = Math.min(BASE_MINUTES * 2 ** (streak - 1), MAX_MINUTES);
  const retryAfter = new Date(latest.createdAt.getTime() + waitMinutes * 60_000);
  return retryAfter > now
    ? { skip: true as const, streak, waitMinutes, retryAfter }
    : { skip: false as const, streak, waitMinutes, retryAfter };
};
