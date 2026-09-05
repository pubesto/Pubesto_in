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
        } else if (session.provider === "google" && session.id) {
          customerInfo = await getShopifyCustomerAdmin(session.id);
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

    // Prepare line items for Shopify Draft Order
    const lineItems = items.map(item => {
      const line = {
        quantity: item.quantity,
      };

      const price = Number(item.discountedUnitPrice || item.price) || 0;

      if (item.variantId && String(item.variantId).includes("gid://shopify/")) {
        line.variantId = item.variantId;
        // Use priceOverride to set the exact dynamic bundle price
        line.priceOverride = {
          amount: String(price.toFixed(2)),
          currencyCode: "INR"
        };
      } else {
        // Fallback to custom item if no Shopify variant ID exists
        line.title = item.name;
        line.originalUnitPrice = String(price.toFixed(2));
      }

      return line;
    });

    const totalAmount = items.reduce((sum, item) => {
      const price = Number(item.discountedUnitPrice || item.price) || 0;
      return sum + (price * item.quantity);
    }, 0);

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

    let response = await fetch(`https://${domain}/admin/api/2023-10/graphql.json`, {
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
      if (draftOrderInput.email) retryInput.email = draftOrderInput.email;
      if (draftOrderInput.phone) retryInput.phone = draftOrderInput.phone;
      
      response = await fetch(`https://${domain}/admin/api/2023-10/graphql.json`, {
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

    return NextResponse.json({ checkoutUrl: fixShopifyCheckoutUrl(checkoutUrl) });

  } catch (error) {
    console.error("Checkout API route error:", error);
    return NextResponse.json({ fallback: true, error: error.message });
  }
}
