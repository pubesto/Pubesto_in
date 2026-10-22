import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { AUTH_COOKIE_NAME, parseSessionToken } from "../../../lib/auth-session";
import { fixShopifyCheckoutUrl, getShopifyStoreDomain } from "../../../lib/shopify-domains";
import { getShopifyCustomer, getShopifyCustomerAdmin } from "../../../lib/shopify-customer";

function formatE164Phone(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (digits.length === 10) {
    return `+91${digits}`;
  }
  if (digits.length === 12 && digits.startsWith("91")) {
    return `+${digits}`;
  }
  if (phone && String(phone).trim().startsWith("+")) {
    return String(phone).trim();
  }
  return null;
}

// Shopify serves its oldest supported version for retired versions; kept as-is because the
// draft order flow is known to work with it. Bump deliberately and re-test checkout.
const ADMIN_API_VERSION = "2023-10";
const MAX_LINE_QUANTITY = 50;

// Look up real variant prices in Shopify so the browser can never set its own price.
async function fetchVariantPrices(domain, adminToken, variantIds) {
  const res = await fetch(`https://${domain}/admin/api/${ADMIN_API_VERSION}/graphql.json`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": adminToken },
    body: JSON.stringify({
      query: `query VariantPrices($ids: [ID!]!) {
        nodes(ids: $ids) { ... on ProductVariant { id price } }
      }`,
      variables: { ids: variantIds },
    }),
  });
  const json = await res.json();
  if (json.errors) throw new Error(`Variant price lookup failed: ${JSON.stringify(json.errors).slice(0, 300)}`);
  const prices = new Map();
  for (const node of json.data?.nodes || []) {
    if (node?.id && node.price != null) prices.set(node.id, Number(node.price));
  }
  return prices;
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { items, discountCode } = body;

    if (!items || items.length === 0) {
      return NextResponse.json({ error: "Cart is empty" }, { status: 400 });
    }

    const domain = getShopifyStoreDomain();
    const adminToken = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;

    if (!adminToken) {
      console.warn("SHOPIFY_ADMIN_ACCESS_TOKEN is not set. Bypassing to storefront checkout.");
      return NextResponse.json({ fallback: true });
    }

    // Fetch user details from session if available
    let customerInfo = null;
    try {
      const cookieStore = await cookies();
      const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
      const session = parseSessionToken(token);
      if (session) {
        if (session.provider === "shopify" && session.customerAccessToken) {
          customerInfo = await getShopifyCustomer(session.customerAccessToken);
        } else if (session.provider === "google" && session.sub) {
          customerInfo = await getShopifyCustomerAdmin(session.sub);
        }

        // Always fallback to session details if customer object wasn't found in Shopify API
        if (!customerInfo && (session.email || session.sub)) {
          customerInfo = {
            id: session.sub,
            email: session.email,
            name: session.name,
          };
        }
      }
    } catch (e) {
      console.warn("Failed to retrieve user session during checkout pre-fill:", e.message);
    }

    // Prepare line items for the Shopify draft order. Prices come from Shopify itself
    // (no priceOverride), so a tampered request can't change what the customer pays.
    const requestedLines = items.map((item) => ({
      variantId: String(item.variantId || ""),
      quantity: Math.min(MAX_LINE_QUANTITY, Math.max(1, Math.floor(Number(item.quantity) || 1))),
    }));

    if (requestedLines.some((line) => !/^gid:\/\/shopify\/ProductVariant\/\d+$/.test(line.variantId))) {
      return NextResponse.json({ error: "Some items in your cart are no longer available. Please remove them and try again." }, { status: 400 });
    }

    const variantPrices = await fetchVariantPrices(domain, adminToken, [...new Set(requestedLines.map((l) => l.variantId))]);
    if (requestedLines.some((line) => !variantPrices.has(line.variantId))) {
      return NextResponse.json({ error: "Some items in your cart are no longer available. Please remove them and try again." }, { status: 400 });
    }

    const lineItems = requestedLines.map((line) => ({ variantId: line.variantId, quantity: line.quantity }));
    const totalAmount = requestedLines.reduce((sum, line) => sum + variantPrices.get(line.variantId) * line.quantity, 0);

    const shippingLine = totalAmount >= 500 ? {
      title: "Free Priority Shipping",
      price: "0.00"
    } : {
      title: "Standard Shipping",
      price: "70.00"
    };

    const draftOrderInput = {
      lineItems,
      shippingLine,
    };

    if (body.paymentMethod === "prepaid" || discountCode === "PREPAID10") {
      draftOrderInput.appliedDiscount = {
        title: "Prepaid 10% Discount",
        value: 10,
        valueType: "PERCENTAGE",
        description: "Additional 10% discount for online prepaid payment"
      };
    }

    if (customerInfo) {
      const shopifyCustomerId = customerInfo.shopifyCustomerId || (String(customerInfo.id).startsWith("gid://shopify/Customer/") ? customerInfo.id : null);
      if (shopifyCustomerId) {
        draftOrderInput.customerId = shopifyCustomerId;
      }

      if (customerInfo.email) {
        draftOrderInput.email = customerInfo.email;
      }
      
      const rawPhone = customerInfo.phone;
      const formattedPhone = formatE164Phone(rawPhone);
      if (formattedPhone) {
        draftOrderInput.phone = formattedPhone;
      }

      // Split name into firstName and lastName
      const nameParts = String(customerInfo.name || "Customer").trim().split(/\s+/);
      const firstName = nameParts[0] || "Customer";
      const lastName = nameParts.slice(1).join(" ") || ".";

      // Check for saved addresses
      let savedAddress = null;
      if (customerInfo.addresses && customerInfo.addresses.length > 0) {
        savedAddress = customerInfo.addresses[0];
      }

      if (savedAddress) {
        const addrNameParts = String(savedAddress.name || customerInfo.name || "Customer").trim().split(/\s+/);
        const addrFirstName = addrNameParts[0] || "Customer";
        const addrLastName = addrNameParts.slice(1).join(" ") || ".";

        draftOrderInput.shippingAddress = {
          firstName: addrFirstName,
          lastName: addrLastName,
          phone: formatE164Phone(savedAddress.phone || rawPhone) || undefined,
          address1: savedAddress.line1 || undefined,
          address2: savedAddress.line2 || undefined,
          city: savedAddress.city || undefined,
          province: savedAddress.state || undefined,
          zip: savedAddress.pincode || undefined,
          country: "India",
        };
      } else {
        draftOrderInput.shippingAddress = {
          firstName,
          lastName,
          phone: formattedPhone || undefined,
          country: "India",
        };
      }
    }

    const query = `
      mutation draftOrderCreate($input: DraftOrderInput!) {
        draftOrderCreate(input: $input) {
          draftOrder {
            id
            invoiceUrl
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    let response = await fetch(`https://${domain}/admin/api/${ADMIN_API_VERSION}/graphql.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": adminToken,
      },
      body: JSON.stringify({
        query,
        variables: {
          input: draftOrderInput
        }
      })
    });

    let resJson = await response.json();

    if (resJson.errors) {
      console.error("Shopify GraphQL Errors:", resJson.errors);
      return NextResponse.json({ fallback: true, errors: resJson.errors });
    }

    // Handle address validation errors, retry without shippingAddress
    const hasAddressErrors = resJson.data?.draftOrderCreate?.userErrors?.some(
      err => err.field && err.field.includes("shippingAddress")
    );

    if (hasAddressErrors && draftOrderInput.shippingAddress) {
      console.warn("Shopify draftOrderCreate failed with shippingAddress errors; retrying with only contact details...");
      
      const retryInput = {
        lineItems,
        shippingLine,
      };
      if (draftOrderInput.appliedDiscount) retryInput.appliedDiscount = draftOrderInput.appliedDiscount;
      if (draftOrderInput.customerId) retryInput.customerId = draftOrderInput.customerId;
      if (draftOrderInput.email) retryInput.email = draftOrderInput.email;
      if (draftOrderInput.phone) retryInput.phone = draftOrderInput.phone;
      
      response = await fetch(`https://${domain}/admin/api/${ADMIN_API_VERSION}/graphql.json`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": adminToken,
        },
        body: JSON.stringify({
          query,
          variables: {
            input: retryInput
          }
        })
      });
      resJson = await response.json();
    }

    const draftOrderData = resJson.data?.draftOrderCreate;
    if (draftOrderData?.userErrors && draftOrderData.userErrors.length > 0) {
      console.error("Shopify User Errors:", draftOrderData.userErrors);
      return NextResponse.json({ fallback: true, userErrors: draftOrderData.userErrors });
    }

    const checkoutUrl = draftOrderData?.draftOrder?.invoiceUrl;
    if (!checkoutUrl) {
      console.error("No invoiceUrl returned from draftOrderCreate");
      return NextResponse.json({ fallback: true });
    }

    const finalUrl = fixShopifyCheckoutUrl(checkoutUrl);
    return NextResponse.json({ 
      checkoutUrl: finalUrl, 
      invoiceUrl: finalUrl 
    });

  } catch (error) {
    console.error("Checkout API route error:", error);
    return NextResponse.json({ fallback: true, error: error.message });
  }
}
