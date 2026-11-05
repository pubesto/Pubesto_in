import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { AppSidebar } from "@/components/admin-dashboard/app-sidebar"
import { ProductEditor } from "@/components/admin-dashboard/product-editor"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"
import { listCategoryOptionsForAdmin } from "@/lib/server/dal/categories"
import { listDiscountCodeOptionsForAdmin } from "@/lib/server/dal/discounts"
import {
  getProductForAdmin,
  listCollectionOptionsForAdmin,
  listProductOptionsForAdmin,
} from "@/lib/server/dal/products"

export const metadata: Metadata = {
  title: "Edit product | Pubesto Admin",
  description: "Edit a product in the Pubesto admin dashboard.",
}

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ productId: string }>
}) {
  const { productId } = await params
  const [product, categories, collections, productOptions, discountCodes] = await Promise.all([
    getProductForAdmin(productId),
    listCategoryOptionsForAdmin(),
    listCollectionOptionsForAdmin(),
    listProductOptionsForAdmin(),
    listDiscountCodeOptionsForAdmin(),
  ])

  if (!product) {
    notFound()
  }

  const primaryVariant = product.variants[0]

  return (
    <TooltipProvider>
      <SidebarProvider className="min-h-svh">
        <AppSidebar />
        <SidebarInset>
          <ProductEditor
            key={product.id}
            categories={categories}
            collections={collections}
            productOptions={productOptions.filter((option) => option.id !== product.id)}
            discountCodes={discountCodes}
            initialProduct={{
              id: product.id,
              title: product.title,
              description: product.description ?? "",
              slug: product.slug,
              status: product.status === "ARCHIVED" ? "DRAFT" : product.status,
              categoryId: product.categoryId ?? "",
              collectionIds: product.collectionIds,
              tags: product.tags,
              price: primaryVariant?.price ?? "0.00",
              compareAtPrice: primaryVariant?.compareAtPrice ?? "",
              inventoryQuantity: String(primaryVariant?.inventoryQuantity ?? 0),
              sku: primaryVariant?.sku ?? "",
              images: product.images.map((image) => ({
                objectKey: image.objectKey,
                url: image.url,
                name: image.altText || product.title,
                altText: image.altText ?? "",
              })),
              variants: product.variants.map((variant) => ({
                title: variant.title,
                price: Number(variant.price),
                compareAtPrice: variant.compareAtPrice === null
                  ? null
                  : Number(variant.compareAtPrice),
                inventoryQuantity: variant.inventoryQuantity,
                optionValues: variant.optionValues,
              })),
              details: product.details,
              pageContent: product.pageContent,
              taxRate: String(product.taxRate ?? 18),
              hsnCode: product.hsnCode ?? "",
              isTaxExempt: product.isTaxExempt ?? false,
            }}
          />
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  )
}
