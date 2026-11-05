/**
 * Fuzzy search, Damerau-Levenshtein distance, token similarity, and spelling correction algorithms.
 */

// Common fashion and apparel synonyms & typo aliases
export const SYNONYM_MAP: Record<string, string[]> = {
  denim: ["jeans", "jean", "bottoms", "pants", "denims"],
  denims: ["denim", "jeans", "pants"],
  jeans: ["denim", "bottoms", "pants", "jean"],
  jean: ["jeans", "denim", "pants"],
  jacket: ["outerwear", "coat", "blazer", "shaket", "jackets"],
  jackets: ["jacket", "outerwear", "coat"],
  pant: ["pants", "jeans", "denim", "trousers", "bottoms"],
  pants: ["pant", "jeans", "denim", "trousers", "bottoms"],
  trouser: ["trousers", "pants", "bottoms"],
  trousers: ["trouser", "pants", "bottoms"],
  shirt: ["tee", "tshirt", "top", "t-shirt", "shirts"],
  shirts: ["shirt", "tee", "top"],
  tshirt: ["t-shirt", "tee", "shirt", "top"],
  tee: ["t-shirt", "tshirt", "shirt", "top"],
  bootcut: ["boot cut", "flared", "flare", "boot-cut"],
  flared: ["flare", "bootcut", "wide"],
  baggy: ["loose", "oversized", "wide"],
  oversized: ["baggy", "loose", "relaxed", "oversize"],
  oversize: ["oversized", "baggy", "loose"],
  relaxed: ["loose", "baggy", "comfort"],
  skinny: ["slim", "tight", "fitted"],
  slim: ["skinny", "fitted", "tailored"],
  straight: ["classic", "regular", "standard", "straight-leg"],
  black: ["charcoal", "dark", "noir"],
  white: ["ivory", "cream", "light"],
  blue: ["navy", "indigo", "azure"],
  brown: ["tan", "beige", "khaki", "camel", "royal brown"],
  cargo: ["cargos", "cargo pants", "utility"],
  cargos: ["cargo", "cargo pants"],
}

/**
 * Calculates Damerau-Levenshtein distance between two strings,
 * which accounts for insertions, deletions, substitutions, and adjacent transpositions (e.g. 'balck' <-> 'black').
 */
export function damerauLevenshteinDistance(source: string, target: string): number {
  if (source === target) return 0
  const s = source.toLowerCase()
  const t = target.toLowerCase()

  const sLen = s.length
  const tLen = t.length

  if (!sLen) return tLen
  if (!tLen) return sLen

  const d: number[][] = []

  for (let i = 0; i <= sLen; i++) {
    d[i] = [i]
  }

  for (let j = 0; j <= tLen; j++) {
    d[0][j] = j
  }

  for (let i = 1; i <= sLen; i++) {
    for (let j = 1; j <= tLen; j++) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1

      d[i][j] = Math.min(
        d[i - 1][j] + 1, // deletion
        d[i][j - 1] + 1, // insertion
        d[i - 1][j - 1] + cost // substitution
      )

      // Transposition check (e.g. 'ba' vs 'ab')
      if (
        i > 1 &&
        j > 1 &&
        s[i - 1] === t[j - 2] &&
        s[i - 2] === t[j - 1]
      ) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1)
      }
    }
  }

  return d[sLen][tLen]
}

/**
 * Calculates normalized similarity ratio between 0 and 1.
 */
export function stringSimilarity(a: string, b: string): number {
  const s1 = a.toLowerCase().trim()
  const s2 = b.toLowerCase().trim()

  if (s1 === s2) return 1.0
  if (!s1.length || !s2.length) return 0.0

  // If one contains the other as substring, give high similarity boost
  if (s1.includes(s2) || s2.includes(s1)) {
    const minLen = Math.min(s1.length, s2.length)
    const maxLen = Math.max(s1.length, s2.length)
    return Math.max(0.75, minLen / maxLen)
  }

  const maxLen = Math.max(s1.length, s2.length)
  const distance = damerauLevenshteinDistance(s1, s2)
  return Math.max(0, 1 - distance / maxLen)
}

/**
 * Checks if query word is close to target word allowing for typos:
 * - 1-2 chars: must be exact match or prefix
 * - 3-5 chars: allow 1 typo / transposition (distance <= 1)
 * - 6+ chars: allow up to 2 typos / transpositions (distance <= 2)
 */
export function isFuzzyMatch(queryWord: string, targetWord: string): boolean {
  const q = queryWord.toLowerCase().trim()
  const t = targetWord.toLowerCase().trim()

  if (!q || !t) return false
  if (t === q || t.includes(q) || q.includes(t)) return true

  if (q.length <= 2) return false

  const maxDistance = q.length <= 5 ? 1 : 2
  const distance = damerauLevenshteinDistance(q, t)

  return distance <= maxDistance
}

/**
 * Returns spelling suggestions from dictionary words based on best similarity.
 */
export function findSpellingSuggestion(
  query: string,
  dictionary: string[]
): string | null {
  const cleanQuery = query.toLowerCase().trim()
  if (!cleanQuery || cleanQuery.length < 3) return null

  const queryWords = cleanQuery.split(/\s+/).filter(Boolean)
  let hasCorrection = false

  const correctedWords = queryWords.map((qWord) => {
    // 1. If word already exists exactly in dictionary, keep it
    if (dictionary.some((w) => w.toLowerCase() === qWord)) {
      return qWord
    }

    // 2. Check synonyms
    if (SYNONYM_MAP[qWord]) {
      for (const syn of SYNONYM_MAP[qWord]) {
        if (dictionary.some((w) => w.toLowerCase() === syn)) {
          hasCorrection = true
          return syn
        }
      }
    }

    // 3. Check fuzzy matches against dictionary with Damerau-Levenshtein
    let bestMatch: string | null = null
    let bestScore = 0

    for (const dictWord of dictionary) {
      const dWord = dictWord.toLowerCase()

      // Quick distance check
      const dist = damerauLevenshteinDistance(qWord, dWord)
      const allowedDist = qWord.length <= 5 ? 1 : 2

      if (dist <= allowedDist) {
        const similarity = stringSimilarity(qWord, dWord)
        if (similarity > bestScore) {
          bestScore = similarity
          bestMatch = dictWord
        }
      }
    }

    if (bestMatch && bestMatch.toLowerCase() !== qWord) {
      hasCorrection = true
      return bestMatch.toLowerCase()
    }

    return qWord
  })

  if (hasCorrection) {
    const suggestion = correctedWords.join(" ")
    return suggestion !== cleanQuery ? suggestion : null
  }

  return null
}
