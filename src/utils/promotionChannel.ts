export type ApplicablePromotionChannel = 'all' | 'web' | 'mobile';
export type RequestPromotionChannel = 'web' | 'mobile' | 'mobile_app';

export function normalizePromotionChannel(
  channel?: string | null
): 'web' | 'mobile' | null {
  if (!channel) return null;

  const normalized = channel.trim().toLowerCase();
  if (normalized === 'mobile' || normalized === 'mobile_app') return 'mobile';
  if (normalized === 'web') return 'web';
  return null;
}

export function isPromotionChannelEligible(
  applicableChannel?: string | null,
  requestChannel?: string | null
): boolean {
  const configuredChannel = (applicableChannel || 'all').trim().toLowerCase();
  if (configuredChannel === 'all') return true;

  const normalizedRequestChannel = normalizePromotionChannel(requestChannel);
  return normalizedRequestChannel !== null && configuredChannel === normalizedRequestChannel;
}

export function getPromotionChannelLabel(applicableChannel?: string | null): string {
  switch ((applicableChannel || 'all').trim().toLowerCase()) {
    case 'web':
      return 'Web App';
    case 'mobile':
      return 'Mobile App';
    default:
      return 'All';
  }
}
