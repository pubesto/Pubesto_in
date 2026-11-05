import type { Metadata } from "next"

import { listOrderCreationOptionsForAdmin } from "@/lib/server/dal/orders"

import { CreateOrderClient } from "../../create-order/create-order-client"

export const metadata: Metadata = {
  title: "Create draft order | Pubesto Admin",
  description: "Create a draft order or invoice in Pubesto.",
}

export default async function CreateDraftOrderPage() {
  const { variants, customers } = await listOrderCreationOptionsForAdmin()
  return <CreateOrderClient variants={variants} customers={customers} mode="draft" />
}
