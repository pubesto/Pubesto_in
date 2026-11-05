"use client"

import { useRouter } from "next/navigation"

import type { Customer } from "@/components/admin-dashboard/customer-data"

export function CustomerTableRows({ customers }: { customers: Customer[] }) {
  const router = useRouter()

  const navigateToCustomer = (customerId: string) => {
    router.push(`/dashboard/customers/${customerId}`)
  }

  return (
    <>
      {customers.map((customer) => (
        <tr
          key={customer.id}
          role="link"
          tabIndex={0}
          onClick={() => navigateToCustomer(customer.id)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault()
              navigateToCustomer(customer.id)
            }
          }}
          className="cursor-pointer outline-none transition hover:bg-black/[0.02] focus-visible:bg-black/[0.04]"
        >
          <td className="border-b border-black/10 px-3 py-2">
            <input type="checkbox" aria-label={`Select ${customer.name}`} onClick={(event) => event.stopPropagation()} />
          </td>
          <td className="border-b border-black/10 px-3 py-2"><span className="font-medium">{customer.name}</span></td>
          <td className="border-b border-black/10 px-3 py-2"><span className={`rounded-full px-2 py-1 ${customer.emailSubscription === "Not subscribed" ? "bg-black/5 text-black/70" : "bg-emerald-100 text-emerald-800"}`}>{customer.emailSubscription}</span></td>
          <td className="border-b border-black/10 px-3 py-2">{customer.location}</td>
          <td className="border-b border-black/10 px-3 py-2 text-right">{customer.orders}</td>
          <td className="border-b border-black/10 px-3 py-2 text-right">{customer.amountSpent}</td>
        </tr>
      ))}
    </>
  )
}
