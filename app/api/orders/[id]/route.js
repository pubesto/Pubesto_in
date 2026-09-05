import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request, { params }) {
  try {
    const { id } = params;
    const trimmedId = (id || "").trim();

    if (!trimmedId) {
      return NextResponse.json({ error: "Order ID is required." }, { status: 400 });
    }

    const domain = process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN || 'jjiygt-gt.myshopify.com';
    const adminToken = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;

    if (!adminToken) {
      return NextResponse.json({ error: "Shopify integration not configured." }, { status: 500 });
    }

    const query = `
      query getOrderByName($query: String!) {
        orders(first: 1, query: $query) {
          edges {
            node {
              id
              name
              createdAt
              cancelledAt
              financialStatus
              fulfillmentStatus
              totalPriceSet {
                shopMoney {
                  amount
                  currencyCode
                }
              }
              subtotalPriceSet {
                shopMoney {
                  amount
                  currencyCode
                }
              }
              totalShippingPriceSet {
                shopMoney {
                  amount
                  currencyCode
                }
              }
              lineItems(first: 50) {
                edges {
                  node {
                    title
                    quantity
                    variant {
                      id
                      title
                      price
                      image {
                        url
                      }
                      product {
                        handle
                        featuredImage {
                          url
                        }
                        images(first: 1) {
                          edges {
                            node {
                              url
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    `;

    const response = await fetch(`https://${domain}/admin/api/2023-10/graphql.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": adminToken,
      },
      body: JSON.stringify({
        query,
        variables: {
          query: `name:${trimmedId}`
        }
      }),
      cache: "no-store",
    });

    const resJson = await response.json();

    if (resJson.errors) {
      console.error("Shopify single order fetch errors:", resJson.errors);
      return NextResponse.json({ error: "Failed to fetch order from Shopify." }, { status: 500 });
    }

    const edges = resJson.data?.orders?.edges || [];
    if (edges.length === 0) {
      return NextResponse.json({ error: "Order not found on Shopify." }, { status: 404 });
    }

    const node = edges[0].node;
    const subtotal = parseFloat(node.subtotalPriceSet?.shopMoney?.amount || 0);
    const shipping = parseFloat(node.totalShippingPriceSet?.shopMoney?.amount || 0);
    const total = parseFloat(node.totalPriceSet?.shopMoney?.amount || 0);

    // Determine order status
    let status = "processing";
    if (node.cancelledAt) {
      status = "cancelled";
    } else if (node.fulfillmentStatus === "FULFILLED") {
      status = "delivered";
    } else if (node.fulfillmentStatus === "PARTIALLY_FULFILLED" || node.fulfillmentStatus === "RESTOCKED") {
      status = "shipped";
    } else {
      status = "processing";
    }

    // Map payment status
    let paymentStatus = "unpaid";
    if (node.financialStatus === "PAID") {
      paymentStatus = "paid";
    }

    const items = (node.lineItems?.edges || []).map(({ node: item }) => {
      const variant = item.variant;
      const slug = variant?.product?.handle || item.title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      const priceNumber = parseFloat(variant?.price || 0);
      
      let color = null;
      if (variant?.title && variant.title !== "Default Title" && variant.title !== "Default") {
        color = variant.title;
      }

      let image = "/images/products/neck-fan.png";
      if (variant?.image?.url) {
        image = variant.image.url;
      } else if (variant?.product?.featuredImage?.url) {
        image = variant.product.featuredImage.url;
      } else if (variant?.product?.images?.edges?.[0]?.node?.url) {
        image = variant.product.images.edges[0].node.url;
      }

      return {
        id: variant?.id || slug,
        name: item.title,
        image,
        price: `Rs. ${priceNumber.toLocaleString("en-IN")}`,
        priceNumber,
        quantity: item.quantity,
        slug,
        color,
      };
    });

    const orderObj = {
      id: node.name, // e.g. "PUB-2026-7215"
      date: node.createdAt,
      items,
      subtotal,
      shipping,
      total,
      status,
      paymentStatus,
      paymentId: node.id,
    };

    return NextResponse.json({ order: orderObj });

  } catch (error) {
    console.error("GET /api/orders/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
