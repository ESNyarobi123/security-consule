import { getCachedDuty, getMyDuty, type GuardDutySite } from '@/services/duty';

export type SiteSummary = {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
};

function toSummary(site: GuardDutySite): SiteSummary {
  return {
    id: site.id,
    code: site.code,
    name: site.name,
    isActive: true,
  };
}

export async function getCachedDemoSite(): Promise<SiteSummary | null> {
  const duty = await getCachedDuty();
  return duty?.site ? toSummary(duty.site) : null;
}

/** Assigned deployment site (cached for offline clock-in). */
export async function resolveDutySite(
  forceRefresh = false,
): Promise<SiteSummary> {
  const duty = await getMyDuty(forceRefresh);
  if (!duty.site) {
    throw new Error(
      duty.note || 'No assigned site. Ask Branch Ops to deploy you.',
    );
  }
  return toSummary(duty.site);
}

/** @deprecated Use resolveDutySite — kept for existing screens. */
export const resolveDemoSite = resolveDutySite;
