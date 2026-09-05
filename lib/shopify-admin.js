import { GraphQLClient } from "graphql-request";
import { getShopifyStoreDomain } from "./shopify-domains";

const shopifyDomain = String(getShopifyStoreDomain() || "").trim();
const adminEndpoint = `https://${shopifyDomain}/admin/api/2024-01/graphql.json`;
const adminToken = String(process.env.SHOPIFY_ADMIN_ACCESS_TOKEN || "").trim();

export const shopifyAdminClient = new GraphQLClient(adminEndpoint, {
  headers: {
    "X-Shopify-Access-Token": adminToken,
    "Content-Type": "application/json",
  },
});

/**
 * Searches for an order by its name (e.g., "PUB-2026-7215" or "#1234").
 */
export async function getShopifyOrderByName(orderName) {
  const query = `
    query getOrderByName($query: String!) {
      orders(first: 1, query: $query) {
        edges {
          node {
            id
            name
            email
            displayFulfillmentStatus
          }
        }
      }
    }
  `;

  // Shopify's query syntax for name
  const variables = {
    query: `name:${orderName.trim()}`,
  };

  try {
    const data = await shopifyAdminClient.request(query, variables);
    const orderNode = data?.orders?.edges?.[0]?.node;
    if (!orderNode) {
      return null;
    }
    return orderNode;
  } catch (error) {
    console.error("Error fetching order from Shopify Admin API:", error);
    throw new Error("Failed to communicate with Shopify.");
  }
}

/**
 * Cancels a Shopify order.
 * @param {string} orderId - The Shopify GraphQL ID of the order (gid://shopify/Order/...)
 * @param {string} rawReason - The user-provided reason
 */
export async function cancelShopifyOrder(orderId, rawReason) {
  const mutation = `
    mutation orderCancel($orderId: ID!, $notifyCustomer: Boolean!, $reason: OrderCancelReason!, $refund: Boolean!, $restock: Boolean!) {
      orderCancel(
        orderId: $orderId,
        notifyCustomer: $notifyCustomer,
        reason: $reason,
        refund: $refund,
        restock: $restock
      ) {
        job {
          id
        }
        orderCancelUserErrors {
          field
          message
        }
      }
    }
  `;

  // Map the frontend reason to Shopify's OrderCancelReason enum
  let reasonEnum = "OTHER";
  if (["ordered_by_mistake", "wrong_product", "found_alternative"].includes(rawReason)) {
    reasonEnum = "CUSTOMER";
  } else if (rawReason === "payment_issue") {
    reasonEnum = "DECLINED";
  }

  const variables = {
    orderId,
    notifyCustomer: true,
    reason: reasonEnum,
    refund: true,
    restock: true,
  };

  try {
    const data = await shopifyAdminClient.request(mutation, variables);
    const errors = data?.orderCancel?.orderCancelUserErrors || [];
    
    if (errors.length > 0) {
      const messages = errors.map(e => e.message).join(", ");
      throw new Error(messages);
    }

    return { success: true };
  } catch (error) {
    console.error("Error cancelling order via Shopify Admin API:", error);
    throw error;
  }
}
