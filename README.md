# Pubesto

Next.js storefront and admin dashboard for [pubesto.com](https://www.pubesto.com). The store runs on its own
PostgreSQL database. Shopify is no longer used at runtime.

| Area | Where |
| --- | --- |
| Storefront (unchanged look) | `app/(store)/**`, `components/*.jsx` |
| Admin dashboard | `app/(admin)/dashboard/**` (`/dashboard`), staff sign-in at `/admin/login` |
| Database schema | `prisma/schema.prisma` (Prisma 7 + PostgreSQL) |
| Server logic | `lib/server/dal` (reads), `lib/server/services` (writes), `app/actions` (server actions) |
| Storefront data adapters | `lib/server/storefront/*` (catalog, account, reviews, hero banners) |
| Auth | better-auth (`lib/auth.ts`); email + password and Google |

The storefront and the dashboard each have their own root layout. This keeps the dashboard's Tailwind 4 / shadcn theme
from mixing with the storefront CSS.

## Dashboard modules

| Module | What you can do |
| --- | --- |
| Home | Overview metrics |
| Orders | Mark paid, fulfil, cancel; add courier/tracking (customers see it in their account) |
| Drafts and abandoned checkouts | Manage draft orders; review carts that were left before checkout |
| Products | Edit variants (each color/size has its own price and stock), images, highlights, specs and per-color photos |
| Collections, categories, inventory | Organise the catalog and adjust stock |
| Customers | Customer list and profiles |
| Reviews | Moderation and homepage testimonials |
| Returns & cancellations | Handle customer requests |
| Messages | Contact form submissions |
| Discounts | Coupon codes |
| Banners | Homepage hero slides |
| Analytics | Traffic, funnel, session recordings, heatmaps |
| Taxes & GST | GSTIN and seller details printed on invoices |
| Staff & permissions | Admins and sub-admins with per-module access |

## Store rules

- Shipping is free from ₹500; below that it costs ₹70.
- Online payment (Razorpay) gets 10% off.
- Coupon codes come from Dashboard → Discounts. The shopper gets whichever saves more: the prepaid discount or the
  coupon. A free-shipping code combines with the prepaid discount.

These rules live in `lib/checkout-rules.ts`. The server recomputes every price, so nothing the browser sends is trusted.

## Local development

Requires Node 20+ and PostgreSQL 18 at `C:\Program Files\PostgreSQL\18`.

```bash
cp .env.example .env        # fill in the values
npm install
npm run db:local:start      # creates/starts the local DB on 127.0.0.1:5434
npx prisma migrate deploy
npm run import:shopify      # optional: copy products, customers and orders from Shopify
npx tsx scripts/register-admin.ts   # or sign up normally, then: ADMIN_EMAIL=you@x.com npm run admin:promote
npm run dev
```

Without an email provider, sign-up and password-reset links are printed in the dev server console.

## Moving production off Shopify

1. **Database.** Create a PostgreSQL database and set `DATABASE_URL`, then run `npx prisma migrate deploy`.
2. **Environment variables.** Set everything in `.env.example` on your host. These are required:
   - `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL`
   - Razorpay keys, and the webhook URL plus `RAZORPAY_WEBHOOK_SECRET`
   - R2, needed for dashboard image uploads
   - SMTP or Resend, needed for order emails and password resets
3. **Import Shopify data.** Run `npm run import:shopify` while the Shopify admin token still works.
   - It downloads product and collection images into `public/uploads/**`. Commit those files.
   - It is safe to run again. Products edited in the dashboard since the last import are left alone, unless you pass
     `--force-products`.
4. **Staff account.** Create the first admin with `npm run admin:promote`. Add more under Dashboard → Staff &
   permissions.
5. **Payment webhook.** Point the Razorpay webhook at `/api/webhooks/razorpay`.
6. **Customer passwords.** Customers keep their orders and addresses, but Shopify passwords can't be moved. On their
   first visit they use "Forgot password" once, or "Continue with Google". The login page tells them this.

Imported orders keep their Shopify numbers (`#1001` …). New orders are numbered `PUB-00001` and up.
