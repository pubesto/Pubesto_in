"use client"

import { createContext, useContext } from "react"

import { resolvePage, type PageKey, type ResolvedPage } from "@/lib/page-content"
import { DEFAULT_SITE_CONTENT, type SiteContent } from "@/lib/site-content"

const SiteContentContext = createContext<SiteContent>(DEFAULT_SITE_CONTENT)

export function SiteContentProvider({
  content,
  children,
}: {
  content: SiteContent
  children: React.ReactNode
}) {
  return <SiteContentContext.Provider value={content}>{children}</SiteContentContext.Provider>
}

export function useSiteContent() {
  return useContext(SiteContentContext)
}

/** Editable page copy + section visibility (see lib/page-content.ts). */
export function usePageContent(key: PageKey): ResolvedPage {
  const content = useContext(SiteContentContext)
  return resolvePage(key, content[key])
}
