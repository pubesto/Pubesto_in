export type TaxSettingData = {
  id: string
  originState: string
  gstin: string
  defaultGstRate: number
  priceInclusive: boolean
  defaultHsn: string
  legalName: string
  businessAddress: string
  updatedAt: string
}

export type TaxSlab = {
  rate: number
  label: string
  description: string
  categoryExamples: string
}

export const GST_SLABS: TaxSlab[] = [
  {
    rate: 0,
    label: "0% (Exempt)",
    description: "Goods and services exempt from GST",
    categoryExamples: "Khadi, handloom, unbranded basic fabrics",
  },
  {
    rate: 5,
    label: "5% GST",
    description: "Concessional rate",
    categoryExamples: "Selected essentials",
  },
  {
    rate: 12,
    label: "12% GST",
    description: "Reduced rate for some household goods",
    categoryExamples: "Selected kitchen and storage items",
  },
  {
    rate: 18,
    label: "18% GST (Pubesto default)",
    description: "Standard rate for most Pubesto products",
    categoryExamples: "Fans, coolers, bottles, lunch boxes, storage",
  },
  {
    rate: 28,
    label: "28% GST",
    description: "Higher rate slab for select luxury articles",
    categoryExamples: "Select luxury watches and imported hardware",
  },
]

export const INDIAN_STATES = [
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chandigarh",
  "Chhattisgarh",
  "Delhi",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jammu and Kashmir",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Ladakh",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Puducherry",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
] as const

export type IndianStateName = (typeof INDIAN_STATES)[number]

export type TaxCalculationResult = {
  grossAmount: number
  taxableAmount: number
  totalGst: number
  cgst: number
  sgst: number
  igst: number
  gstRate: number
  isIntraState: boolean
  isInclusive: boolean
}

export function calculateGst(
  amount: number,
  rate: number,
  isInclusive: boolean,
  originState: string,
  destinationState?: string | null
): TaxCalculationResult {
  const normOrigin = (originState || "Delhi").trim().toLowerCase()
  const normDest = (destinationState || normOrigin).trim().toLowerCase()
  const isIntraState = normOrigin === normDest

  let grossAmount = amount
  let taxableAmount = 0
  let totalGst = 0

  if (rate <= 0) {
    taxableAmount = amount
    totalGst = 0
  } else if (isInclusive) {
    taxableAmount = Number((amount / (1 + rate / 100)).toFixed(2))
    totalGst = Number((amount - taxableAmount).toFixed(2))
  } else {
    taxableAmount = amount
    totalGst = Number((amount * (rate / 100)).toFixed(2))
    grossAmount = Number((taxableAmount + totalGst).toFixed(2))
  }

  let cgst = 0
  let sgst = 0
  let igst = 0

  if (isIntraState) {
    cgst = Number((totalGst / 2).toFixed(2))
    sgst = Number((totalGst - cgst).toFixed(2))
  } else {
    igst = totalGst
  }

  return {
    grossAmount,
    taxableAmount,
    totalGst,
    cgst,
    sgst,
    igst,
    gstRate: rate,
    isIntraState,
    isInclusive,
  }
}

export type MonthlyGstLedgerRow = {
  month: number
  monthKey: string // YYYY-MM
  monthName: string
  year: number
  orderCount: number
  grossSales: number
  taxableSales: number
  cgst: number
  sgst: number
  igst: number
  totalGst: number
  products: Array<{
    id: string
    title: string
    hsn: string
    quantity: number
    taxableAmount: number
    gstRate: number
    gstAmount: number
  }>
  states: Array<{
    state: string
    isIntraState: boolean
    orderCount: number
    taxableAmount: number
    cgst: number
    sgst: number
    igst: number
    totalGst: number
  }>
  orders: MonthlyGstOrder[]
}

export type MonthlyGstOrderItem = {
  id: string
  title: string
  sku: string
  quantity: number
  unitPrice: number
  total: number
  hsnCode: string
  taxRate: number
  taxableAmount: number
  cgst: number
  sgst: number
  igst: number
  tax: number
}

export type MonthlyGstOrder = {
  id: string
  number: number
  createdAt: string
  customerName: string
  email: string
  state: string
  isIntraState: boolean
  taxableAmount: number
  cgst: number
  sgst: number
  igst: number
  totalGst: number
  total: number
  items: MonthlyGstOrderItem[]
  shippingAddress?: {
    name?: string
    address1?: string
    address2?: string
    city?: string
    state?: string
    postalCode?: string
    country?: string
    phone?: string
  } | null
}

export function numberToWordsINR(amount: number): string {
  if (isNaN(amount) || amount <= 0) return "Zero Rupees Only"

  const singleDigits = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"]
  const teens = [
    "Ten",
    "Eleven",
    "Twelve",
    "Thirteen",
    "Fourteen",
    "Fifteen",
    "Sixteen",
    "Seventeen",
    "Eighteen",
    "Nineteen",
  ]
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"]

  function convertTwoDigits(n: number): string {
    if (n === 0) return ""
    if (n < 10) return singleDigits[n]
    if (n >= 10 && n < 20) return teens[n - 10]
    const rem = n % 10
    return tens[Math.floor(n / 10)] + (rem !== 0 ? " " + singleDigits[rem] : "")
  }

  function convertThreeDigits(n: number): string {
    const hundred = Math.floor(n / 100)
    const rest = n % 100
    let str = ""
    if (hundred > 0) {
      str += singleDigits[hundred] + " Hundred"
      if (rest > 0) str += " and "
    }
    if (rest > 0) {
      str += convertTwoDigits(rest)
    }
    return str
  }

  const [rupeesPart, paisePart] = amount.toFixed(2).split(".").map(Number)

  let n = rupeesPart
  const crore = Math.floor(n / 10000000)
  n %= 10000000
  const lakh = Math.floor(n / 100000)
  n %= 100000
  const thousand = Math.floor(n / 1000)
  n %= 1000
  const hundredAndBelow = n

  let res = ""
  if (crore > 0) res += convertThreeDigits(crore) + " Crore "
  if (lakh > 0) res += convertThreeDigits(lakh) + " Lakh "
  if (thousand > 0) res += convertThreeDigits(thousand) + " Thousand "
  if (hundredAndBelow > 0) res += convertThreeDigits(hundredAndBelow)

  res = res.trim()
  if (!res) res = "Zero"
  res += " Rupees"

  if (paisePart > 0) {
    res += " and " + convertTwoDigits(paisePart) + " Paise"
  }
  res += " Only"
  return res
}

export type MonthlyGstAnalytics = {
  year: number
  availableYears: number[]
  summary: {
    grossSales: number
    taxableSales: number
    totalGst: number
    totalCgst: number
    totalSgst: number
    totalIgst: number
    orderCount: number
    averageGstPerOrder: number
  }
  monthlyLedger: MonthlyGstLedgerRow[]
  productSummaries: Array<{
    title: string
    hsn: string
    totalUnits: number
    taxableSales: number
    totalGst: number
    gstRate: number
  }>
  settings: TaxSettingData
}
