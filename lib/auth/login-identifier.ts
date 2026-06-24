const defaultAdminUsername = "19tpdls";
const defaultAdminEmail = "19tpdls@picup-picnic.local";

export function resolveLoginEmail(identifier: string) {
  const normalizedIdentifier = identifier.trim();

  if (normalizedIdentifier.includes("@")) {
    return normalizedIdentifier;
  }

  const adminUsername =
    process.env.ADMIN_LOGIN_USERNAME?.trim() || defaultAdminUsername;
  const adminEmail = process.env.ADMIN_LOGIN_EMAIL?.trim() || defaultAdminEmail;

  if (normalizedIdentifier === adminUsername) {
    return adminEmail;
  }

  return normalizedIdentifier;
}
