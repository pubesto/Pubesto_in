import "server-only"

import { getPrisma } from "@/lib/server/db"
import {
  findSpellingSuggestion,
  isFuzzyMatch,
  stringSimilarity,
  SYNONYM_MAP,
} from "@/lib/search/fuzzy"

function imageUrl(objectKey: string) {
  if (objectKey.startsWith("/")) {
    return objectKey
  }

  if (objectKey.startsWith("uploads/")) {
    return `/${objectKey}`
  }

  const baseUrl = process.env.R2_PUBLIC_URL?.replace(/\/$/, "")
  return baseUrl ? `${baseUrl}/${objectKey}` : null
}

function extractOptionValues(optionValues: any): string[] {
  if (!optionValues) return []
  if (typeof optionValues === "string") return [optionValues.toLowerCase()]
  if (typeof optionValues === "object") {
    return Object.values(optionValues).flatMap((val) => {
      if (typeof val === "string") return [val.toLowerCase()]
      if (typeof val === "object" && val !== null && "name" in val) {
        return [String((val as any).name).toLowerCase()]
      }
      return []
    })
  }
  return []
}

export type SearchProductResult = {
  id: string
  title: string
  slug: string
  categoryName: string | null
  price: string
  compareAtPrice: string | null
  image: string
  alt: string
  badge?: string
  isInStock: boolean
  score: number
}

export type SearchCategoryResult = {
  id: string
  name: string
  slug: string
}

export type SearchCollectionResult = {
  id: string
  title: string
  slug: string
}

export type SearchResponse = {
  query: string
  suggestion: string | null
  hasExactMatch: boolean
  products: SearchProductResult[]
  categories: SearchCategoryResult[]
  collections: SearchCollectionResult[]
  totalCount: number
}

export async function searchCatalog(rawQuery: string): Promise<SearchResponse> {
  const query = (rawQuery || "").trim().toLowerCase()

  if (!query) {
    return {
      query: "",
      suggestion: null,
      hasExactMatch: true,
      products: [],
      categories: [],
      collections: [],
      totalCount: 0,
    }
  }

  const prisma = getPrisma()

  // Fetch all active products, categories, collections
  const [products, categories, collections] = await Promise.all([
    prisma.product.findMany({
      where: { status: "ACTIVE" },
      select: {
        id: true,
        title: true,
        slug: true,
        description: true,
        tags: true,
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        collections: {
          select: {
            collection: {
              select: {
                id: true,
                title: true,
                slug: true,
              },
            },
          },
        },
        variants: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            title: true,
            price: true,
            compareAtPrice: true,
            inventoryQuantity: true,
            optionValues: true,
          },
        },
        images: {
          orderBy: { position: "asc" },
          take: 1,
          select: {
            objectKey: true,
            altText: true,
          },
        },
      },
    }),
    prisma.category.findMany({
      where: { status: "ACTIVE", visible: true },
      select: { id: true, name: true, slug: true },
    }),
    prisma.collection.findMany({
      where: { isPublished: true },
      select: { id: true, title: true, slug: true },
    }),
  ])

  // Build dictionary of words from store & fashion catalog
  const dictionarySet = new Set<string>()
  const commonFashionTerms = [
    "denim", "denims", "jeans", "jean", "bootcut", "straight", "wide", "baggy", "relaxed",
    "skinny", "low", "waist", "jacket", "jackets", "t-shirt", "tee", "shirt", "pant", "pants",
    "trouser", "trousers", "oversized", "black", "white", "blue", "brown", "beige", "ivory",
    "charcoal", "collection", "cotton", "bestseller", "arrival", "classic", "vintage", "fit",
    "cargo", "cargos", "wash", "distressed", "tailored", "monochrome", "royal"
  ]
  commonFashionTerms.forEach((t) => dictionarySet.add(t))

  // Add words from existing products, categories, collections, and variant attributes
  products.forEach((p) => {
    p.title.split(/\s+/).forEach((w) => {
      const clean = w.replace(/[^a-zA-Z0-9-]/g, "").toLowerCase()
      if (clean.length > 1) dictionarySet.add(clean)
    })
    if (p.category?.name) {
      p.category.name.split(/\s+/).forEach((w) => {
        const clean = w.replace(/[^a-zA-Z0-9-]/g, "").toLowerCase()
        if (clean.length > 1) dictionarySet.add(clean)
      })
    }
    p.tags.forEach((tag) => {
      tag.split(/\s+/).forEach((w) => {
        const clean = w.replace(/[^a-zA-Z0-9-]/g, "").toLowerCase()
        if (clean.length > 1) dictionarySet.add(clean)
      })
    })
    p.variants.forEach((v) => {
      extractOptionValues(v.optionValues).forEach((val) => {
        val.split(/\s+/).forEach((w) => {
          const clean = w.replace(/[^a-zA-Z0-9-]/g, "").toLowerCase()
          if (clean.length > 1) dictionarySet.add(clean)
        })
      })
    })
  })

  categories.forEach((c) => {
    c.name.split(/\s+/).forEach((w) => {
      const clean = w.replace(/[^a-zA-Z0-9-]/g, "").toLowerCase()
      if (clean.length > 1) dictionarySet.add(clean)
    })
  })

  collections.forEach((c) => {
    c.title.split(/\s+/).forEach((w) => {
      const clean = w.replace(/[^a-zA-Z0-9-]/g, "").toLowerCase()
      if (clean.length > 1) dictionarySet.add(clean)
    })
  })

  const dictionary = Array.from(dictionarySet)
  const suggestion = findSpellingSuggestion(query, dictionary)

  const searchTokens = query.split(/\s+/).filter(Boolean)
  const suggestionTokens = suggestion ? suggestion.split(/\s+/).filter(Boolean) : []

  // Score & rank products
  const scoredProducts: Array<SearchProductResult & { score: number }> = []
  let foundDirectMatch = false

  for (const product of products) {
    let score = 0
    const titleLower = product.title.toLowerCase()
    const descLower = (product.description || "").toLowerCase()
    const catNameLower = (product.category?.name || "").toLowerCase()
    const tagStrings = product.tags.map((t) => t.toLowerCase())
    const collectionTitles = product.collections.map((c) => c.collection.title.toLowerCase())
    const variantAttributes = product.variants.flatMap((v) => extractOptionValues(v.optionValues))

    // 1. Direct query matching
    if (titleLower.includes(query)) {
      score += 120
      foundDirectMatch = true
    } else if (
      catNameLower.includes(query) ||
      collectionTitles.some((c) => c.includes(query)) ||
      variantAttributes.some((a) => a.includes(query))
    ) {
      score += 90
      foundDirectMatch = true
    } else if (tagStrings.some((t) => t.includes(query))) {
      score += 80
      foundDirectMatch = true
    } else if (descLower.includes(query)) {
      score += 40
      foundDirectMatch = true
    }

    // 2. Token-level matching (exact, synonyms, fuzzy)
    for (const token of searchTokens) {
      if (titleLower.includes(token)) {
        score += 50
        foundDirectMatch = true
      } else if (catNameLower.includes(token) || collectionTitles.some((c) => c.includes(token))) {
        score += 40
        foundDirectMatch = true
      } else if (variantAttributes.some((a) => a.includes(token))) {
        score += 40
        foundDirectMatch = true
      } else if (tagStrings.some((t) => t.includes(token))) {
        score += 35
        foundDirectMatch = true
      }

      // Synonyms
      const synonyms = SYNONYM_MAP[token] || []
      for (const syn of synonyms) {
        if (
          titleLower.includes(syn) ||
          catNameLower.includes(syn) ||
          tagStrings.some((t) => t.includes(syn)) ||
          variantAttributes.some((a) => a.includes(syn))
        ) {
          score += 35
          foundDirectMatch = true
          break
        }
      }

      // Fuzzy matching across title words, tags, category, and variant attributes
      const titleWords = titleLower.split(/\s+/)
      for (const tWord of titleWords) {
        if (isFuzzyMatch(token, tWord)) {
          score += 30
          break
        }
      }

      if (isFuzzyMatch(token, catNameLower)) {
        score += 25
      }

      for (const attr of variantAttributes) {
        if (isFuzzyMatch(token, attr)) {
          score += 30
          break
        }
      }
    }

    // 3. Typo Suggestion Boosting (if suggestion was generated)
    if (suggestionTokens.length > 0) {
      for (const sToken of suggestionTokens) {
        if (titleLower.includes(sToken)) {
          score += 60
        } else if (
          catNameLower.includes(sToken) ||
          variantAttributes.some((a) => a.includes(sToken)) ||
          collectionTitles.some((c) => c.includes(sToken))
        ) {
          score += 50
        } else if (tagStrings.some((t) => t.includes(sToken))) {
          score += 40
        } else if (descLower.includes(sToken)) {
          score += 25
        }
      }
    }

    // Fallback: If score is 0 and no direct matches across store, give baseline score for active products
    if (score > 10) {
      const variant = product.variants[0]
      const image = product.images[0]
      const imageSrc = image ? (imageUrl(image.objectKey) ?? "") : ""

      const badge = product.tags.find((t) =>
        ["NEW ARRIVAL", "BESTSELLER", "SALE", "HOT", "TRENDING", "LIMITED"].includes(t.toUpperCase())
      )?.toUpperCase()

      scoredProducts.push({
        id: product.id,
        title: product.title,
        slug: product.slug,
        categoryName: product.category?.name ?? null,
        price: variant ? `₹${variant.price.toString()}` : "N/A",
        compareAtPrice: variant?.compareAtPrice ? `₹${variant.compareAtPrice.toString()}` : null,
        image: imageSrc,
        alt: image?.altText || product.title,
        badge,
        isInStock: product.variants.some((v) => v.inventoryQuantity > 0),
        score,
      })
    }
  }

  // Sort products by score descending
  scoredProducts.sort((a, b) => b.score - a.score)

  // Matching Categories
  const matchedCategories = categories.filter((cat) => {
    const cName = cat.name.toLowerCase()
    return (
      cName.includes(query) ||
      searchTokens.some((tok) => isFuzzyMatch(tok, cName)) ||
      (suggestion && cName.includes(suggestion))
    )
  })

  // Matching Collections
  const matchedCollections = collections.filter((col) => {
    const cTitle = col.title.toLowerCase()
    return (
      cTitle.includes(query) ||
      searchTokens.some((tok) => isFuzzyMatch(tok, cTitle)) ||
      (suggestion && cTitle.includes(suggestion))
    )
  })

  // Behavioural analytics: what shoppers search for and what returns nothing.
  if (query.length >= 2) {
    void prisma.searchLog
      .create({
        data: {
          query: rawQuery.trim().slice(0, 200),
          normalized: query.slice(0, 200),
          resultCount: scoredProducts.length,
          suggestion: suggestion && suggestion !== query ? suggestion.slice(0, 200) : null,
        },
      })
      .catch(() => {})
  }

  return {
    query: rawQuery,
    suggestion: suggestion && suggestion.toLowerCase() !== query.toLowerCase() ? suggestion : null,
    hasExactMatch: foundDirectMatch,
    products: scoredProducts.slice(0, 12),
    categories: matchedCategories.slice(0, 4),
    collections: matchedCollections.slice(0, 4),
    totalCount: scoredProducts.length,
  }
}
