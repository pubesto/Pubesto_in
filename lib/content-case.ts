/**
 * Suos stored catalogue text in uppercase. Pubesto keeps names exactly as
 * typed ("Arctic Air Ultra Cooler"), so this is now a pass-through that the
 * admin editors still call.
 */
export function toAdminUppercase(value: string) {
  return value
}
