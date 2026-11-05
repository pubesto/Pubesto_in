import "server-only"

/**
 * Turns a stored image key into a URL. Keys are either site paths
 * ("/images/..."), files saved under public/uploads ("uploads/...") or R2
 * object keys served from R2_PUBLIC_URL.
 */
export function mediaUrl(objectKey: string | null | undefined): string | null {
  if (!objectKey) return null
  if (/^https?:\/\//i.test(objectKey)) return objectKey
  if (objectKey.startsWith("/")) return objectKey
  if (objectKey.startsWith("uploads/")) return `/${objectKey}`
  const baseUrl = process.env.R2_PUBLIC_URL?.replace(/\/$/, "")
  return baseUrl ? `${baseUrl}/${objectKey}` : `/${objectKey}`
}
