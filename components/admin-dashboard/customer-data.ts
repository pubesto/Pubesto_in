export type Customer = {
  id: string
  name: string
  email: string
  emailSubscription: "Subscribed" | "Not subscribed"
  location: string
  orders: number
  amountSpent: string
  customerSince: string
  rfmGroup: string
  defaultAddress: string
}

export const customers: Customer[] = [
  {
    id: "mohd-kaif",
    name: "MOHD KAIF",
    email: "mohdkaif18th@gmail.com",
    emailSubscription: "Not subscribed",
    location: "New Delhi DL, India",
    orders: 0,
    amountSpent: "₹0.00",
    customerSince: "4 days",
    rfmGroup: "Prospects",
    defaultAddress: "No address provided",
  },
  {
    id: "hardeep-harnal",
    name: "HARDEEP HARNAL",
    email: "hardeep.harnal@example.com",
    emailSubscription: "Subscribed",
    location: "MOHALI PB, India",
    orders: 1,
    amountSpent: "₹8,258.82",
    customerSince: "2 months",
    rfmGroup: "Active customers",
    defaultAddress: "Mohali PB, India",
  },
]
