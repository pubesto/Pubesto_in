import { GraphQLClient } from "graphql-request";
import { fixShopifyCheckoutUrl, getShopifyStoreDomain } from "./shopify-domains";

// Server: authenticate with the private Storefront token (it is never sent to browsers).
// Browser: call without a token. Shopify allows tokenless Storefront access for products,
// collections and carts, and this store rejects every public token with 401 (verified
// 2026-10-22), so a public token would only fail.
const privateToken = String(process.env.SHOPIFY_STOREFRONT_PRIVATE_TOKEN || "").trim();

const shopifyDomain = String(getShopifyStoreDomain() || "").trim();
const endpoint = `https://${shopifyDomain}/api/2023-10/graphql.json`;

export const shopifyClient = new GraphQLClient(endpoint, {
  headers: privateToken ? { "Shopify-Storefront-Private-Token": privateToken } : {},
});

export function getShopifyStorefrontUrl(path = "/") {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `https://${shopifyDomain}${normalizedPath}`;
}

export function getShopifyAccountUrl() {
  return getShopifyStorefrontUrl("/account");
}

export function getShopifyAccountLoginUrl() {
  return getShopifyStorefrontUrl("/account/login");
}

export function getShopifyAccountAddressesUrl() {
  return getShopifyStorefrontUrl("/account/addresses");
}

export function getShopifyCartUrl() {
  return fixShopifyCheckoutUrl(getShopifyStorefrontUrl("/cart"));
}

export function getShopifyVariantNumericId(variantId) {
  const value = String(variantId || "");
  if (/^\d+$/.test(value)) return value;
  return value.match(/ProductVariant\/(\d+)/)?.[1] || null;
}

export function getShopifyVariantIdForColor(productSlug, colorName) {
  const slug = String(productSlug || "").toLowerCase();
  const color = String(colorName || "").toLowerCase();
  
  if (slug.includes("neck-fan")) {
    if (color.includes("white") || color.includes("arctic") || color.includes("silver") || color.includes("blue")) {
      return "gid://shopify/ProductVariant/51732555497688";
    }
    if (color.includes("pink") || color.includes("blush")) {
      return "gid://shopify/ProductVariant/51699472203992";
    }
    if (color.includes("green") || color.includes("forest") || color.includes("black")) {
      return "gid://shopify/ProductVariant/51688308375768";
    }
  }
  return null;
}

export function getShopifyCartPermalink(items = []) {
  const expandedItems = [];
  
  for (const item of items) {
    const qty = Math.max(1, Number(item.quantity) || 1);
    const color = item.product?.selectedColor || item.color;
    
    let variantId = null;
    if (color) {
      variantId = getShopifyVariantIdForColor(item.product?.slug || item.slug, color);
    }
    if (!variantId) {
      variantId = item.product?.shopifyVariantId || item.product?.variantId || item.product?.sku || item.variantId;
    }
    
    const existing = expandedItems.find(e => e.variantId === variantId);
    if (existing) {
      existing.quantity += qty;
    } else {
      expandedItems.push({
        variantId,
        quantity: qty
      });
    }
  }

  const lines = expandedItems
    .map((item) => {
      const variantNumericId = getShopifyVariantNumericId(item.variantId);
      return variantNumericId ? `${variantNumericId}:${item.quantity}` : null;
    })
    .filter(Boolean);

  if (lines.length === 0) return getShopifyCartUrl();

  return fixShopifyCheckoutUrl(getShopifyStorefrontUrl(`/cart/${lines.join(",")}`));
}

function normalizeHighlight(value) {
  return String(value || "")
    .replace(/^[\s\-*•]+/, "")
    .trim();
}

export function parseShopifyHighlights(value) {
  if (Array.isArray(value)) {
    return value.map(normalizeHighlight).filter(Boolean);
  }

  if (!value) return [];

  const rawValue = String(value).trim();
  if (!rawValue) return [];

  try {
    const parsed = JSON.parse(rawValue);
    if (Array.isArray(parsed)) {
      return parsed.map(normalizeHighlight).filter(Boolean);
    }
    if (parsed && typeof parsed === "object") {
      return Object.values(parsed).flat().map(normalizeHighlight).filter(Boolean);
    }
  } catch {
    // Shopify list metafields are JSON; plain text metafields are not.
  }

  return rawValue
    .split(/\r?\n|[|;]/)
    .map(normalizeHighlight)
    .filter(Boolean);
}

function getFirstMetafieldHighlights(...metafields) {
  for (const metafield of metafields) {
    const highlights = parseShopifyHighlights(metafield?.value);
    if (highlights.length > 0) {
      return highlights;
    }
  }

  return [];
}

// Newest uploads first, so the default product order shows new arrivals at the top.
export const PRODUCTS_QUERY = `
  {
    products(first: 250, sortKey: CREATED_AT, reverse: true) {
      edges {
        node {
          id
          title
          handle
          description
          availableForSale
          createdAt
          tags
          keyHighlights: metafield(namespace: "custom", key: "key_highlights") {
            type
            value
          }
          keyHighlight: metafield(namespace: "custom", key: "key_highlight") {
            type
            value
          }
          highlights: metafield(namespace: "custom", key: "highlights") {
            type
            value
          }
          productHighlights: metafield(namespace: "custom", key: "product_highlights") {
            type
            value
          }
          keyFeatures: metafield(namespace: "custom", key: "key_features") {
            type
            value
          }
          features: metafield(namespace: "custom", key: "features") {
            type
            value
          }
          detailHighlights: metafield(namespace: "details", key: "key_highlights") {
            type
            value
          }
          globalHighlights: metafield(namespace: "global", key: "highlights") {
            type
            value
          }
          ratingMetafield: metafield(namespace: "custom", key: "rating") {
            value
          }
          reviewsCountMetafield: metafield(namespace: "custom", key: "reviews_count") {
            value
          }
          reviewsListMetafield: metafield(namespace: "custom", key: "reviews_list") {
            value
          }
          reviewsRatingMetafield: metafield(namespace: "reviews", key: "rating") {
            value
          }
          reviewsCountMetafield2: metafield(namespace: "reviews", key: "rating_count") {
            value
          }
          reviewsListMetafield2: metafield(namespace: "reviews", key: "list") {
            value
          }
          bundleMetafield: metafield(namespace: "custom", key: "bundle") {
            type
            value
            references(first: 10) {
              edges {
                node {
                  ... on Product {
                    id
                    title
                    handle
                    availableForSale
                    images(first: 1) {
                      edges {
                        node {
                          url
                          altText
                        }
                      }
                    }
                    variants(first: 1) {
                      edges {
                        node {
                          id
                          availableForSale
                          price {
                            amount
                            currencyCode
                          }
                          compareAtPrice {
                            amount
                            currencyCode
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
          images(first: 25) {
            edges {
              node {
                url
                altText
              }
            }
          }
          variants(first: 250) {
            edges {
              node {
                id
                title
                availableForSale
                price {
                  amount
                  currencyCode
                }
                compareAtPrice {
                  amount
                  currencyCode
                }
                selectedOptions {
                  name
                  value
                }
                image {
                  url
                }
              }
            }
          }
          collections(first: 10) {
            edges {
              node {
                title
                handle
              }
            }
          }
        }
      }
    }
  }
`;

// Shopify collections that drive homepage sections rather than shopping categories.
// "frontpage" is Shopify's built-in "Home page" collection; "featured" is also accepted.
export const FEATURED_COLLECTION_HANDLES = ["featured", "frontpage"];
const HIDDEN_CATEGORY_HANDLES = new Set(FEATURED_COLLECTION_HANDLES);

// Real sales ranking from Shopify (BEST_SELLING) and the merchant's own ordering of the
// featured collection. Returned as handle -> rank (1 = first).
const MERCHANDISING_QUERY = `
  {
    bestSelling: products(first: 250, sortKey: BEST_SELLING) {
      edges { node { handle } }
    }
    featured: collection(handle: "featured") {
      products(first: 50, sortKey: COLLECTION_DEFAULT) { edges { node { handle } } }
    }
    frontpage: collection(handle: "frontpage") {
      products(first: 50, sortKey: COLLECTION_DEFAULT) { edges { node { handle } } }
    }
  }
`;

function toRankMap(edges) {
  const map = new Map();
  (edges || []).forEach(({ node }, index) => {
    if (node?.handle && !map.has(node.handle)) map.set(node.handle, index + 1);
  });
  return map;
}

async function getMerchandisingRanks() {
  try {
    const data = await shopifyClient.request(MERCHANDISING_QUERY);
    // A "featured" collection, if the merchant creates one, takes priority over "Home page".
    const featuredEdges = data.featured?.products?.edges?.length
      ? data.featured.products.edges
      : data.frontpage?.products?.edges;
    return {
      salesRanks: toRankMap(data.bestSelling?.edges),
      featuredRanks: toRankMap(featuredEdges),
    };
  } catch (error) {
    console.error("Error fetching Shopify merchandising ranks:", error);
    return { salesRanks: new Map(), featuredRanks: new Map() };
  }
}

export async function getShopifyProducts() {
  try {
    const [data, { salesRanks, featuredRanks }] = await Promise.all([
      shopifyClient.request(PRODUCTS_QUERY),
      getMerchandisingRanks(),
    ]);
    return data.products.edges.map(({ node }) => {
      const filteredImages = (node.images?.edges || [])
        .map(e => e.node.url);
      return {
        id: node.id,
        name: node.title,
        slug: node.handle,
        shopifyHandle: node.handle,
        description: node.description,
        image: filteredImages[0] || "https://placehold.co/600x600/1b624b/ffffff?text=Pubesto",
        gallery: filteredImages,
      price: `₹${parseFloat(node.variants.edges[0]?.node.price.amount || 0).toLocaleString('en-IN')}`,
      oldPrice: node.variants.edges[0]?.node.compareAtPrice 
        ? `₹${parseFloat(node.variants.edges[0].node.compareAtPrice.amount).toLocaleString('en-IN')}` 
        : null,
      salePrice: parseFloat(node.variants.edges[0]?.node.price.amount || 0),
      originalPrice: node.variants.edges[0]?.node.compareAtPrice 
        ? parseFloat(node.variants.edges[0].node.compareAtPrice.amount) 
        : null,
        categories: node.collections.edges
          .filter(e => !HIDDEN_CATEGORY_HANDLES.has(e.node.handle))
          .map(e => e.node.title),
        createdAt: node.createdAt,
        tags: node.tags || [],
        salesRank: salesRanks.get(node.handle) || null,
        featuredRank: featuredRanks.get(node.handle) || null,
        inStock: node.availableForSale,
        highlights: (() => {
          const metafieldHighlights = getFirstMetafieldHighlights(
            node.keyHighlights,
            node.keyHighlight,
          node.highlights,
          node.productHighlights,
          node.keyFeatures,
          node.features,
          node.detailHighlights,
          node.globalHighlights
        );
        const tagHighlights = Array.isArray(node.tags) ? node.tags.map(normalizeHighlight).filter(Boolean) : [];

          return metafieldHighlights.length > 0
            ? metafieldHighlights
            : tagHighlights.length > 0
              ? tagHighlights
              : [];
        })(),
      variants: (node.variants?.edges || []).map(({ node: v }) => ({
        id: v.id,
        title: v.title,
        price: parseFloat(v.price?.amount || 0),
        compareAtPrice: v.compareAtPrice ? parseFloat(v.compareAtPrice.amount) : null,
        selectedOptions: v.selectedOptions || [],
        image: v.image?.url || null,
        available: v.availableForSale
      })),
      shopifyVariantId: node.variants.edges[0]?.node.id,
      sku: node.variants.edges[0]?.node.id,
      rating: node.ratingMetafield?.value || node.reviewsRatingMetafield?.value || null,
      reviews: node.reviewsCountMetafield?.value || node.reviewsCountMetafield2?.value || null,
      reviewsList: (() => {
        const val = node.reviewsListMetafield?.value || node.reviewsListMetafield2?.value;
        if (val) {
          try {
            const parsed = JSON.parse(val);
            if (Array.isArray(parsed)) {
              return parsed.map((r, idx) => {
                if (typeof r === "string") {
                  return {
                    text: r,
                    name: `Verified Buyer ${idx + 1}`,
                    rating: null,
                    image: null
                  };
                }
                return {
                  text: r.text || r.body || "",
                  name: r.name || r.author || `Verified Buyer ${idx + 1}`,
                  rating: r.rating || null,
                  image: r.image || null
                };
              });
            }
          } catch (e) {
            console.error("Error parsing reviewsList metafield:", e);
          }
        }
        return null;
      })(),
      bundleProducts: (() => {
        const bundleMeta = node.bundleMetafield;
        if (!bundleMeta || !bundleMeta.references) return [];
        return bundleMeta.references.edges
          .map(({ node: refProduct }) => {
            if (!refProduct || !refProduct.id) return null;
            const variant = refProduct.variants?.edges?.[0]?.node;
            return {
              id: refProduct.id,
              name: refProduct.title,
              slug: refProduct.handle,
              image: refProduct.images?.edges?.[0]?.node?.url || null,
              inStock: refProduct.availableForSale,
              price: parseFloat(variant?.price?.amount || 0),
              compareAtPrice: variant?.compareAtPrice ? parseFloat(variant.compareAtPrice.amount) : null,
              shopifyVariantId: variant?.id || null,
            };
          })
          .filter(Boolean);
      })()
    };
  });
  } catch (error) {
    console.error("Error fetching Shopify products:", error);
    return [];
  }
}

export const COLLECTIONS_QUERY = `
  {
    collections(first: 50) {
      edges {
        node {
          id
          title
          handle
          image {
            url
            altText
          }
        }
      }
    }
  }
`;

export async function getShopifyCollections() {
  try {
    const data = await shopifyClient.request(COLLECTIONS_QUERY);
    return data.collections.edges.map(({ node }) => ({
      name: node.title,
      label: node.title,
      slug: node.handle,
      image: node.image?.url || "https://placehold.co/600x600/1b624b/ffffff?text=Category",
    })).filter(c => !HIDDEN_CATEGORY_HANDLES.has(c.slug) && c.name.toLowerCase() !== 'home page');
  } catch (error) {
    console.error("Error fetching Shopify collections:", error);
    return [];
  }
}

export async function createShopifyCart() {
  const mutation = `
    mutation {
      cartCreate {
        cart {
          id
          checkoutUrl
        }
      }
    }
  `;
  const data = await shopifyClient.request(mutation);
  const cart = data.cartCreate.cart;
  if (cart?.checkoutUrl) {
    cart.checkoutUrl = fixShopifyCheckoutUrl(cart.checkoutUrl);
  }
  return cart;
}

export async function addToShopifyCart(cartId, variantId, quantity = 1) {
  const mutation = `
    mutation addToCart($cartId: ID!, $lines: [CartLineInput!]!) {
      cartLinesAdd(cartId: $cartId, lines: $lines) {
        cart {
          id
          checkoutUrl
        }
      }
    }
  `;
  const variables = {
    cartId,
    lines: [{ quantity, merchandiseId: variantId }]
  };
  const data = await shopifyClient.request(mutation, variables);
  const cart = data.cartLinesAdd.cart;
  if (cart?.checkoutUrl) {
    cart.checkoutUrl = fixShopifyCheckoutUrl(cart.checkoutUrl);
  }
  return cart;
}

export async function getShopifyVariantIdByHandle(handle) {
  const query = `
    query getProductVariant($handle: String!) {
      productByHandle(handle: $handle) {
        variants(first: 1) {
          edges {
            node {
              id
            }
          }
        }
      }
    }
  `;
  const productData = await shopifyClient.request(query, { handle });
  return productData?.productByHandle?.variants?.edges?.[0]?.node?.id || null;
}

/**
 * Given a Shopify product handle and quantity, creates a fresh Shopify cart
 * with that item and returns the checkout URL for direct redirect.
 */
export async function getShopifyCheckoutUrl(handle, quantity = 1) {
  // 1. Fetch the product variant ID by handle
  const variantId = await getShopifyVariantIdByHandle(handle);

  if (!variantId) {
    throw new Error(`No Shopify variant found for handle: ${handle}`);
  }

  // 2. Create a new cart with the item
  const mutation = `
    mutation createCartWithItem($lines: [CartLineInput!]!) {
      cartCreate(input: { lines: $lines }) {
        cart {
          id
          checkoutUrl
        }
        userErrors {
          field
          message
        }
      }
    }
  `;
  const cartData = await shopifyClient.request(mutation, {
    lines: [{ quantity, merchandiseId: variantId }]
  });

  const checkoutUrl = cartData?.cartCreate?.cart?.checkoutUrl;
  if (!checkoutUrl) {
    throw new Error("Failed to create Shopify checkout URL.");
  }

  return fixShopifyCheckoutUrl(checkoutUrl);
}
