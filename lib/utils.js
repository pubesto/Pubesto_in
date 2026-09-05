import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merges class names with Tailwind CSS conflict resolution.
 * Standard shadcn/ui utility function.
 *
 * @param {...(string|undefined|null|boolean|object)} inputs - Class names to merge
 * @returns {string} Merged class string
 */
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export function formatPrice(value) {
  return `Rs. ${value.toLocaleString("en-IN")}`;
}
