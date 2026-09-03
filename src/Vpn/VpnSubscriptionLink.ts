/**
 * Extracts a client name from the application's own subscription link only.
 * This is deliberately pure: the expected public origin and path prefix will
 * be supplied by the DragoNet configuration in stage 5.
 */
export type VpnSubscriptionLinkConfiguration = Readonly<{
  origin: string;
  pathPrefix: string;
  maxClientNameLength?: number;
}>;

const DEFAULT_MAX_CLIENT_NAME_LENGTH = 256;

const toPathSegments = (path: string): string[] => path.split('/').filter(Boolean);

const getAllowedOrigin = (origin: string): string | undefined => {
  try {
    const url = new URL(origin);
    const hasOnlyOrigin = url.pathname === '/' && !url.search && !url.hash;
    return url.protocol === 'https:' && hasOnlyOrigin && !url.username && !url.password
      ? url.origin
      : undefined;
  } catch {
    return undefined;
  }
};

/**
 * Returns undefined for a non-HTTPS URL, another origin/path, malformed
 * percent-encoding, an empty name, or a name containing a control character.
 * `decodeURIComponent` is intentionally called exactly once; the resulting
 * client name keeps its original case and such symbols as [], @ and _.
 */
export const extractVpnClientName = (
  link: string,
  configuration: VpnSubscriptionLinkConfiguration,
): string | undefined => {
  const allowedOrigin = getAllowedOrigin(configuration.origin);
  const requiredSegments = toPathSegments(configuration.pathPrefix);
  const maxLength = configuration.maxClientNameLength ?? DEFAULT_MAX_CLIENT_NAME_LENGTH;

  if (!allowedOrigin || requiredSegments.length === 0 || !Number.isSafeInteger(maxLength) || maxLength < 1) {
    return undefined;
  }

  try {
    const url = new URL(link);
    if (url.protocol !== 'https:' || url.origin !== allowedOrigin) {
      return undefined;
    }

    const pathSegments = toPathSegments(url.pathname);
    if (
      pathSegments.length <= requiredSegments.length
      || !requiredSegments.every((segment, index) => pathSegments[index] === segment)
    ) {
      return undefined;
    }

    const clientName = decodeURIComponent(pathSegments[pathSegments.length - 1]);
    if (
      !clientName
      || Array.from(clientName).length > maxLength
      || /[\u0000-\u001F\u007F-\u009F]/.test(clientName)
      || clientName.includes('/')
      || clientName.includes('\\')
    ) {
      return undefined;
    }

    return clientName;
  } catch {
    return undefined;
  }
};
