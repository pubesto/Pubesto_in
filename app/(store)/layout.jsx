import "./globals.css";
import Script from "next/script";
import "./ui.css";
import { Suspense } from "react";
import { connection } from "next/server";
import { getStorefrontCatalog } from "@/lib/server/storefront/catalog";
import { getHeroSlides } from "@/lib/server/storefront/banners";
import { Plus_Jakarta_Sans } from "next/font/google";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
  variable: "--font-body",
});

import { META_PIXEL_ID } from "@/lib/meta-config";

const metaPixelScript = `
!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${META_PIXEL_ID}');
`;

export const metadata = {
  title: "Pubesto | Cooling gadgets, bottles & everyday essentials",
  description: "Pubesto home decor, lunch storage, water bottles, and daily essentials.",
  icons: {
    icon: "/favicon.png",
    shortcut: "/favicon.png",
    apple: "/favicon.png",
  },
  verification: {
    google: "kPT-8lUP7LJr9ikYrHRaKP2SaOweJnFn6PydX-NFOmk",
  },
};

import { Providers } from "./providers";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Drawers from "@/components/Drawers";
import CartDrawer from "@/components/CartDrawer";
import MetaPixelRouteTracker from "@/components/MetaPixelRouteTracker";
import { AnalyticsBeacon } from "@/components/analytics/AnalyticsBeacon";
import { SessionRecorder } from "@/components/analytics/SessionRecorder";

export default async function RootLayout({ children }) {
  // Catalog comes from our database on every request, so dashboard edits show immediately.
  await connection();
  const [{ products, categories }, heroSlides] = await Promise.all([getStorefrontCatalog(), getHeroSlides()]);

  return (
    <html lang="en" className={jakarta.variable} style={{ "--font-display": "var(--font-body)" }} data-scroll-behavior="smooth" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <Script
          strategy="afterInteractive"
          src="https://www.googletagmanager.com/gtag/js?id=G-EX08SKW4J0"
        />
        <Script
          id="google-analytics"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());

              gtag('config', 'G-EX08SKW4J0');
            `,
          }}
        />
        <Script
          id="meta-pixel"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: metaPixelScript,
          }}
        />
        <Script
          id="microsoft-clarity"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              (function(c,l,a,r,i,t,y){
                  c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
                  t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
                  y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
              })(window, document, "clarity", "script", "xpc40dp76w");
            `,
          }}
        />
        <noscript>
          <img
            height="1"
            width="1"
            style={{ display: "none" }}
            src={`https://www.facebook.com/tr?id=${META_PIXEL_ID}&ev=PageView&noscript=1`}
            alt=""
          />
        </noscript>
        <MetaPixelRouteTracker />
        {/* Dashboard → Analytics: traffic, funnel, recordings, heatmaps */}
        <AnalyticsBeacon />
        <SessionRecorder />
        <Providers products={products} categories={categories} heroSlides={heroSlides}>
          <Suspense fallback={null}>
            <Header />
          </Suspense>
          <Drawers />
          <CartDrawer />
          {children}
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
