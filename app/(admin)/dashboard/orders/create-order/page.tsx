import type { Metadata } from "next"

import { CreateOrderClient } from "./create-order-client"
import { listOrderCreationOptionsForAdmin } from "@/lib/server/dal/orders"

export const metadata: Metadata = {
  title: "Create order | Pubesto Admin",
  description: "Create draft orders, add products, and configure payment details.",
}

export default async function CreateOrderPage() {
  const { variants, customers } = await listOrderCreationOptionsForAdmin()

  return <CreateOrderClient variants={variants} customers={customers} />
}
