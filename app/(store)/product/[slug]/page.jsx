import { getStorefrontCatalog } from "@/lib/server/storefront/catalog";
import { getSiteUrl } from "@/lib/server/env";
import ProductPageClient from "./ProductPageClient";

// Server wrapper: renders each product's own <title>, meta description, Open Graph
// tags, canonical URL and Product JSON-LD. The interactive page is ProductPageClient.

const DESCRIPTION_LIMIT = 160;

async function findProduct(slug) {
  const target = decodeURIComponent(String(slug || "")).toLowerCase();
  if (!target) return null;
  const { products } = await getStorefrontCatalog();
  // Same matching as the client page: exact slug first, then a partial match.
  return (
    products.find((p) => String(p.slug).toLowerCase() === target) ||
    products.find((p) => String(p.slug).toLowerCase().includes(target)) ||
    null
  );
}

function plainText(value) {
  return String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function truncate(text, max) {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  return `${cut.slice(0, cut.lastIndexOf(" ") > 80 ? cut.lastIndexOf(" ") : cut.length)}…`;
}

function seoTitle(product) {
  return product.seoTitle?.trim() || `${product.name} | Pubesto`;
}

function seoDescription(product) {
  return (
    product.seoDescription?.trim() ||
    truncate(plainText(product.description), DESCRIPTION_LIMIT) ||
    product.detail ||
    `Buy ${product.name} online at Pubesto.`
  );
}

function absoluteUrl(url, siteUrl) {
  if (!url) return null;
  try {
    return new URL(url, `${siteUrl}/`).toString();
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const product = await findProduct(slug);
  if (!product) return {};

  const siteUrl = getSiteUrl();
  const title = seoTitle(product);
  const description = seoDescription(product);
  const canonical = `${siteUrl}/product/${product.slug}`;
  const image = absoluteUrl(product.image, siteUrl);

  return {
    title: { absolute: title },
    description,
    alternates: { canonical },
    openGraph: {
      type: "website",
      siteName: "Pubesto",
      url: canonical,
      title,
      description,
      ...(image ? { images: [{ url: image, alt: product.name }] } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      ...(image ? { images: [image] } : {}),
    },
  };
}

function productJsonLd(product, siteUrl) {
  const url = `${siteUrl}/product/${product.slug}`;
  const images = [...new Set([product.image, ...(product.gallery || [])])]
    .map((img) => absoluteUrl(img, siteUrl))
    .filter(Boolean);

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: seoDescription(product),
    image: images,
    url,
    ...(product.sku ? { sku: product.sku } : {}),
    brand: { "@type": "Brand", name: "Pubesto" },
    offers: {
      "@type": "Offer",
      url,
      price: Number(product.salePrice || 0).toFixed(2),
      priceCurrency: "INR",
      availability: product.inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      itemCondition: "https://schema.org/NewCondition",
    },
  };
}

export default async function ProductPage({ params }) {
  const { slug } = await params;
  const product = await findProduct(slug);

  return (
    <>
      {product ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(productJsonLd(product, getSiteUrl())).replace(/</g, "\\u003c"),
          }}
        />
      ) : null}
      <ProductPageClient />
    </>
  );
}
