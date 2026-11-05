export type ProductCategory = {
  id: string
  title: string
  slug: string
  parentId: string | null
  productCount: number
  visible: boolean
}

export const defaultProductCategories: ProductCategory[] = [
  { id: "women", title: "Women", slug: "women", parentId: null, productCount: 68, visible: true },
  { id: "men", title: "Men", slug: "men", parentId: null, productCount: 54, visible: true },
  { id: "jeans", title: "Jeans", slug: "jeans", parentId: "women", productCount: 31, visible: true },
  { id: "t-shirts", title: "T-shirts", slug: "t-shirts", parentId: "men", productCount: 24, visible: true },
  { id: "dresses", title: "Dresses", slug: "dresses", parentId: "women", productCount: 18, visible: true },
  { id: "accessories", title: "Accessories", slug: "accessories", parentId: null, productCount: 12, visible: false },
]
