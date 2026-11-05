"use server"

import { searchCatalog, type SearchResponse } from "@/lib/server/dal/search"

export async function searchCatalogAction(query: string): Promise<SearchResponse> {
  try {
    return await searchCatalog(query)
  } catch (error) {
    console.error("Failed to search catalog:", error)
    return {
      query,
      suggestion: null,
      hasExactMatch: false,
      products: [],
      categories: [],
      collections: [],
      totalCount: 0,
    }
  }
}
