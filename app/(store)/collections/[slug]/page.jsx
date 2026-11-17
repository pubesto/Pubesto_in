import { notFound } from "next/navigation";
import { getStorefrontCatalog } from "@/lib/server/storefront/catalog";
import { getSiteUrl } from "@/lib/server/env";
import ShopView from "../../shop/ShopView";

// /collections/<slug>: the shop listing filtered to one published collection.

async function findCollection(slug) {
  const target = decodeURIComponent(String(slug || "")).toLowerCase();
  const { categories } = await getStorefrontCatalog();
  return categories.find((c) => String(c.slug).toLowerCase() === target) || null;
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const collection = await findCollection(slug);
  if (!collection) return {};
  const title = `${collection.label || collection.name} | Pubesto`;
  const description = `Shop ${collection.label || collection.name} at Pubesto: practical picks for Indian homes.`;
  const canonical = `${getSiteUrl()}/collections/${collection.slug}`;
  return {
    title: { absolute: title },
    description,
    alternates: { canonical },
    openGraph: { type: "website", siteName: "Pubesto", url: canonical, title, description },
  };
}

export default async function CollectionPage({ params }) {
  const { slug } = await params;
  const collection = await findCollection(slug);
  if (!collection) notFound();
  return <ShopView collection={collection.name} />;
}
