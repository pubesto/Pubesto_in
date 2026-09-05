import fs from "fs";
const env = fs.readFileSync(".env", "utf-8").split("\n").reduce((acc, line) => {
  const [key, ...value] = line.split("=");
  if (key && value) acc[key.trim()] = value.join("=").trim();
  return acc;
}, {});

Object.assign(process.env, env);

import { createShopifyCustomer, loginShopifyCustomer } from "./lib/shopify-customer.js";

async function main() {
  try {
    const res = await createShopifyCustomer({
      name: "Test User",
      email: "test81924@example.com",
      password: "password123",
      phone: "+911234567890"
    });
    console.log("Success:", res);
  } catch (error) {
    console.error("Error creating customer:", error.message);
    if (error.userErrors) {
      console.error("User Errors:", JSON.stringify(error.userErrors, null, 2));
    }
  }
}

main();
