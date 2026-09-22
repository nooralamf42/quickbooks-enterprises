import { promises as dns } from 'dns';

export interface MxCheckResult {
  valid: boolean;
  reason?: string;
}

async function hasARecord(domain: string): Promise<boolean> {
  try {
    const a = await dns.resolve4(domain);
    if (a.length > 0) return true;
  } catch {
    // fall through to AAAA
  }
  try {
    const aaaa = await dns.resolve6(domain);
    if (aaaa.length > 0) return true;
  } catch {
    // no AAAA either
  }
  return false;
}

/** Checks whether an email's domain can receive mail at all — the same check that would
 *  have caught "pchtechnoloies.com" (a typo with zero mail servers) before ever attempting
 *  a send, instead of discovering it only after itWALK and Postal both bounced it
 *  independently. Only a domain DNS clearly reports as having no MX *and* no fallback A/AAAA
 *  record (the RFC 5321 implicit-MX case) is flagged invalid — any other DNS error (timeout,
 *  a hiccup on our own resolver) fails OPEN, since a transient lookup failure on our side
 *  should never block a legitimate send. This only proves the domain is reachable, not that
 *  the specific mailbox exists — that would need an SMTP-level check, which most receiving
 *  servers (Barracuda included, per a bounce seen in this project) block or lie to. */
export async function checkDomainHasMailServer(email: string): Promise<MxCheckResult> {
  const domain = email.split('@')[1]?.trim().toLowerCase();
  if (!domain) return { valid: false, reason: 'No domain in email address' };

  try {
    const mxRecords = await dns.resolveMx(domain);
    if (mxRecords && mxRecords.length > 0) return { valid: true };
  } catch (err: any) {
    if (err?.code !== 'ENOTFOUND' && err?.code !== 'ENODATA') {
      // Ambiguous error (timeout, SERVFAIL, our resolver being flaky) — don't block a
      // legitimate send over it.
      return { valid: true };
    }
    // ENOTFOUND/ENODATA means DNS positively has no MX records — check the A/AAAA
    // fallback below before concluding the domain can't receive mail at all.
  }

  if (await hasARecord(domain)) return { valid: true };

  return { valid: false, reason: `No mail servers found for ${domain}` };
}
