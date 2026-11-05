import { z } from "zod"

/**
 * Editable storefront pages (login, cart, checkout…). Each page is a list of
 * sections; each section has text/image fields and, when `hideable`, a
 * show/hide switch. The admin form is generated from these definitions, and
 * only the values that were edited need storing: anything missing falls back
 * to the default here. To make more copy editable, add a field below and read
 * it with `page.text(section, field)` in the component.
 */
export type FieldDef = {
  id: string
  label: string
  kind: "text" | "textarea" | "image"
  default: string
  hint?: string
}

export type SectionDef = {
  id: string
  label: string
  hint?: string
  /** Can be switched off in the admin. Required sections (forms) can't. */
  hideable: boolean
  fields: FieldDef[]
}

export type PageDef = { label: string; description: string; sections: SectionDef[] }

const text = (id: string, label: string, value: string, hint?: string): FieldDef => ({ id, label, kind: "text", default: value, hint })
const area = (id: string, label: string, value: string, hint?: string): FieldDef => ({ id, label, kind: "textarea", default: value, hint })
const image = (id: string, label: string, value: string, hint?: string): FieldDef => ({ id, label, kind: "image", default: value, hint })

export const PAGE_DEFS = {
  loginPage: {
    label: "Login page",
    description: "The /login page.",
    sections: [
      { id: "image", label: "Side image", hint: "Left half on laptops and desktops; hidden on phones.", hideable: true, fields: [
        image("src", "Image", "/images/hero-left.png", "About 1440 × 1800 px (portrait)."),
        text("alt", "Image description (alt text)", "Model wearing a denim jacket from the Pubesto collection"),
      ] },
      { id: "intro", label: "Heading", hideable: false, fields: [
        text("heading", "Heading", "Log in"),
        area("text", "Intro text", "Access your favourites, follow your orders, and stay connected to the latest edits."),
      ] },
      { id: "mobile", label: "Mobile number login", hint: "Mobile login needs an SMS (OTP) service before it works. Hide it until that's set up.", hideable: true, fields: [
        text("legend", "Label", "Log in or register"),
        text("placeholder", "Field placeholder", "10-digit mobile number"),
        text("button", "Button", "Login"),
        text("newsletter", "Newsletter tick-box", "Notify me for updates and offers"),
      ] },
      { id: "email", label: "Email & password login", hint: "Keep this on unless another login method is working.", hideable: true, fields: [
        text("button", "Button", "Login with email"),
      ] },
      { id: "terms", label: "Terms note", hideable: true, fields: [
        text("text", "Text before the links", "By proceeding, you agree to our", "Followed by the T&C and Privacy Policy links."),
      ] },
      { id: "social", label: "Google login", hideable: true, fields: [
        text("heading", "Heading", "Access with"),
        area("text", "Text before the Privacy Policy link", "By logging in with my social login, I agree to link my account in accordance with the"),
        text("google", "Google button", "Continue with Google"),
      ] },
      { id: "qr", label: "QR login button", hint: "QR login isn't connected yet.", hideable: true, fields: [
        text("button", "Button", "Continue with QR"),
      ] },
      { id: "signup", label: "Create-account link", hideable: true, fields: [
        text("text", "Text", "New to Pubesto?"),
        text("link", "Link", "Create account"),
      ] },
    ],
  },
  signupPage: {
    label: "Sign-up page",
    description: "The /signin (create account) page.",
    sections: [
      { id: "image", label: "Side image", hint: "Left half on laptops and desktops; hidden on phones.", hideable: true, fields: [
        image("src", "Image", "/images/hero-left.png", "About 1440 × 1800 px (portrait)."),
        text("alt", "Image description (alt text)", "Model wearing a denim jacket from the Pubesto collection"),
      ] },
      { id: "intro", label: "Heading", hideable: false, fields: [
        text("heading", "Heading", "Create your account"),
        area("text", "Intro text", "Save your favourites, follow your orders, and receive access to our latest edits."),
      ] },
      { id: "form", label: "Form", hideable: false, fields: [
        text("button", "Button", "Create account"),
      ] },
      { id: "terms", label: "Terms note", hideable: true, fields: [
        text("text", "Text before the links", "By creating an account, you agree to our", "Followed by the Terms & Conditions and Privacy Policy links."),
        area("after", "Text after the links", "You also consent to receive marketing and promotional communications from Pubesto. You may unsubscribe at any time."),
      ] },
      { id: "login", label: "Log-in link", hideable: true, fields: [
        text("text", "Text", "Already have an account?"),
        text("link", "Link", "Log in"),
      ] },
    ],
  },
  cartPage: {
    label: "Cart",
    description: "The shopping bag page (/cart) and the side cart.",
    sections: [
      { id: "header", label: "Heading", hideable: false, fields: [
        text("heading", "Heading", "Shopping Bag"),
      ] },
      { id: "urgency", label: "“Not reserved” note", hideable: true, fields: [
        text("text", "Text", "Items in bag are not reserved and may sell out. Order now."),
      ] },
      { id: "promo", label: "Promo code box", hint: "The bag page only previews codes; the real discount is applied at checkout.", hideable: true, fields: [
        text("label", "Label", "Have a promo code?"),
      ] },
      { id: "rewards", label: "Rewards banner", hint: "There's no rewards programme yet; hide this until there is.", hideable: true, fields: [
        text("heading", "Heading", "Rewards"),
        text("text", "Text", "Sign in or Join Pubesto Rewards now"),
      ] },
      { id: "summary", label: "Order summary", hideable: false, fields: [
        text("checkout", "Checkout button", "Start Checkout"),
      ] },
      { id: "installments", label: "“4 interest-free payments” line", hint: "No instalment option is connected; hide this unless there is one.", hideable: true, fields: [] },
      { id: "express", label: "Express pay buttons", hint: "UPI / GPay and Cards / Netbanking shortcuts under the checkout button.", hideable: true, fields: [] },
      { id: "trust", label: "Trust lines", hideable: true, fields: [
        area("lines", "Lines", "Pubesto members enjoy complimentary returns\n100% Authentic Pubesto Atelier Guarantee", "One per line."),
      ] },
      { id: "gift", label: "Gift note", hideable: true, fields: [
        text("text", "Text", "Gift options available in checkout"),
      ] },
      { id: "empty", label: "Empty bag", hideable: false, fields: [
        text("heading", "Heading", "Your Bag is Empty"),
        area("text", "Text", "Discover new arrivals and signature pieces crafted for timeless elegance."),
        text("button", "Button", "Shop New Collections"),
      ] },
      { id: "recommendations", label: "“Before You Go” products", hideable: true, fields: [
        text("heading", "Heading", "Before You Go"),
        text("text", "Text", "Curated pieces to complete your wardrobe"),
      ] },
      { id: "sidebar", label: "Side cart", hideable: false, fields: [
        text("empty", "Empty text", "Your cart is empty"),
        text("checkout", "Checkout button", "Checkout"),
        text("viewCart", "Link to the bag page", "View Shopping Cart"),
      ] },
      { id: "offerProgress", label: "Side cart offer progress bar", hideable: true, fields: [] },
      { id: "marquee", label: "Side cart scrolling strip", hideable: true, fields: [
        text("text", "Text", "Additional Discount on Pre-paid | Free Return and Exchange"),
      ] },
      { id: "sideRecommendations", label: "Side cart recommendations", hideable: true, fields: [] },
    ],
  },
  checkoutPage: {
    label: "Checkout",
    description: "The /checkout page. The form fields themselves stay fixed so orders always have what they need.",
    sections: [
      { id: "help", label: "“Need help?” link", hideable: true, fields: [
        text("text", "Text", "Need help?"),
        text("link", "Link text", "Email us"),
        text("email", "Email address", "support@pubesto.com"),
      ] },
      { id: "express", label: "Express checkout buttons", hideable: true, fields: [
        text("heading", "Heading", "Express Checkout"),
      ] },
      { id: "contact", label: "Email step", hideable: false, fields: [
        text("heading", "Heading", "Email Address"),
        text("newsletter", "Newsletter tick-box", "I would like to receive updates on the latest products and promotions"),
      ] },
      { id: "shipping", label: "Address step", hideable: false, fields: [
        text("heading", "Heading", "Shipping To"),
        text("note", "Note", "Sorry we cannot ship to P.O. Boxes."),
      ] },
      { id: "gift", label: "Gift note option", hideable: true, fields: [
        text("label", "Tick-box label", "Add a free gift note"),
      ] },
      { id: "method", label: "Shipping method step", hideable: false, fields: [
        text("heading", "Heading", "Shipping Method"),
        text("note", "Note under the heading", "Shipping options may update once an address is entered."),
        area("info", "Information box", "Orders placed by 12:00 pm IST Monday-Friday usually process the same day.\nShipping price may update once the address is entered.", "One per line."),
        text("continue", "Continue button", "Continue to Payment"),
      ] },
      { id: "payment", label: "Payment step", hideable: false, fields: [
        text("heading", "Heading", "Payment"),
        text("text", "Text", "All transactions are encrypted and secure."),
      ] },
      { id: "promo", label: "Promo code box", hideable: true, fields: [
        text("label", "Label", "Have a promo code?"),
      ] },
      { id: "installments", label: "“4 payments of …” line", hint: "No instalment option is connected; hide this unless there is one.", hideable: true, fields: [] },
      { id: "trust", label: "Trust lines", hideable: true, fields: [
        area("lines", "Lines", "Encrypted 256-bit Secure Checkout\n100% Authentic Pubesto Atelier Guarantee\nComplimentary 30-Day Returns", "One per line. The first gets a lock icon."),
      ] },
      { id: "thankYou", label: "Order confirmation", hideable: false, fields: [
        text("heading", "Heading", "Thank You For Your Order"),
        text("text", "Text before the email address", "A confirmation receipt and tracking updates have been dispatched to"),
      ] },
      { id: "footerLinks", label: "Policy links at the bottom", hideable: true, fields: [
        text("returns", "Text before the Return Policy link", "30 day returns", "Make sure this matches the real returns policy."),
      ] },
    ],
  },
  wishlistPage: {
    label: "Wishlist",
    description: "The /wishlist page and the side wishlist.",
    sections: [
      { id: "header", label: "Heading", hideable: false, fields: [
        text("heading", "Heading", "My Wishlist"),
      ] },
      { id: "share", label: "Share button", hideable: true, fields: [
        text("label", "Label", "Share Wishlist"),
      ] },
      { id: "empty", label: "Empty wishlist", hideable: false, fields: [
        text("text", "Text", "Your wishlist is empty"),
        text("button", "Button", "Continue Shopping"),
      ] },
      { id: "sidebar", label: "Side wishlist", hideable: false, fields: [
        text("viewAll", "Link to the wishlist page", "View Full Wishlist"),
      ] },
    ],
  },
  trackOrderPage: {
    label: "Track order",
    description: "The /track-order page.",
    sections: [
      { id: "intro", label: "Heading", hideable: false, fields: [
        text("heading", "Heading", "Track your order"),
        text("text", "Text", "Enter your details below to view your order status"),
        text("button", "Button", "Check order status"),
      ] },
      { id: "signIn", label: "“Have an account” panel", hideable: true, fields: [
        text("heading", "Heading", "Have an account"),
        text("text", "Text", "Sign in below to view your order history"),
      ] },
    ],
  },
  shopPage: {
    label: "Shop",
    description: "The /shop page (all products, new arrivals, bestsellers).",
    sections: [
      { id: "empty", label: "No products", hideable: false, fields: [
        text("heading", "Heading", "Nothing here yet"),
        text("text", "Text (no products at all)", "New pieces are on their way. Check back soon."),
        area("filteredText", "Text (nothing matches a filter)", "We couldn't find pieces matching this selection. New styles land often — have a look at everything else."),
        text("button", "Button", "Shop all"),
      ] },
    ],
  },
  collectionsPage: {
    label: "Collections",
    description: "The /collections page and the benefits bar on each collection page.",
    sections: [
      { id: "hero", label: "Top banner", hideable: true, fields: [
        image("src", "Image", "", "Leave empty to use the first collection's image. Full width, about 2880 × 1400 px."),
        text("alt", "Image description (alt text)", "Pubesto collections"),
      ] },
      { id: "empty", label: "No collections", hideable: false, fields: [
        text("heading", "Heading", "No collections yet"),
        area("text", "Text", "Collections are being curated. In the meantime, browse everything we make."),
        text("button", "Button", "Shop all"),
      ] },
      { id: "benefits", label: "Benefits bar", hint: "Shown on the Collections, Shop and each collection page. Leave a title empty to drop that benefit.", hideable: true, fields: [
        text("title1", "Benefit 1 title", "FREE SHIPPING"),
        text("text1", "Benefit 1 text", "On orders above ₹2,900"),
        text("short1", "Benefit 1 text on phones", "Over ₹2,900"),
        text("title2", "Benefit 2 title", "FREE RETURNS"),
        text("text2", "Benefit 2 text", "On full priced items only"),
        text("short2", "Benefit 2 text on phones", "Full price only"),
        text("title3", "Benefit 3 title", "PAYMENT SECURE"),
        text("text3", "Benefit 3 text", "Guaranteed payment protection"),
        text("short3", "Benefit 3 text on phones", "100% Protected"),
      ] },
    ],
  },
} satisfies Record<string, PageDef>

export type PageKey = keyof typeof PAGE_DEFS
export const PAGE_KEYS = Object.keys(PAGE_DEFS) as PageKey[]

/** What's stored: only edited values; everything else uses the defaults above. */
export type StoredPageContent = {
  sections: Record<string, { visible?: boolean; fields?: Record<string, string> }>
}

export const storedPageContentSchema = z.object({
  sections: z
    .record(
      z.string().max(40),
      z.object({
        visible: z.boolean().optional(),
        fields: z.record(z.string().max(40), z.string().max(4000)).optional(),
      }),
    )
    .default({}),
})

export const EMPTY_PAGE_CONTENT: StoredPageContent = { sections: {} }

const isImagePath = (v: string) => v.startsWith("/") || /^https?:\/\//.test(v)

/** Read helpers for a page: stored value, else the default. */
export function resolvePage(key: PageKey, stored: StoredPageContent | undefined) {
  const def: PageDef = PAGE_DEFS[key]
  const sections = stored?.sections ?? {}
  const fieldDef = (sectionId: string, fieldId: string) =>
    def.sections.find((s) => s.id === sectionId)?.fields.find((f) => f.id === fieldId)

  return {
    /** Hideable sections can be switched off; others are always shown. */
    show(sectionId: string) {
      const section = def.sections.find((s) => s.id === sectionId)
      if (!section?.hideable) return true
      return sections[sectionId]?.visible !== false
    },
    text(sectionId: string, fieldId: string) {
      const f = fieldDef(sectionId, fieldId)
      const value = sections[sectionId]?.fields?.[fieldId]
      if (value === undefined) return f?.default ?? ""
      // An image field cleared or mistyped falls back to the default image.
      if (f?.kind === "image" && !isImagePath(value.trim())) return f.default
      return value
    },
    lines(sectionId: string, fieldId: string) {
      return this.text(sectionId, fieldId).split("\n").map((l) => l.trim()).filter(Boolean)
    },
  }
}

export type ResolvedPage = ReturnType<typeof resolvePage>
