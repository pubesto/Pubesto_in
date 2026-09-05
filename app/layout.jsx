import "./globals.css";
import Script from "next/script";
import { Inter, Cormorant_Garamond } from "next/font/google";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-body",
});

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
  variable: "--font-display",
});

const metaPixelIds = ["1229284689266211"];

const metaPixelScript = `
!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
${metaPixelIds.map((pixelId) => `fbq('init', '${pixelId}');`).join("\n")}
fbq('track', 'PageView');
`;

export const metadata = {
  title: "Pubesto | Artisanal Ecommerce",
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
import Header from "../components/Header";
import Footer from "../components/Footer";
import Drawers from "../components/Drawers";
import MetaPixelRouteTracker from "../components/MetaPixelRouteTracker";

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${inter.variable} ${cormorant.variable}`} data-scroll-behavior="smooth" suppressHydrationWarning>
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
          {metaPixelIds.map((pixelId) => (
            <img
              key={pixelId}
              height="1"
              width="1"
              style={{ display: "none" }}
              src={`https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1`}
              alt=""
            />
          ))}
        </noscript>
        <MetaPixelRouteTracker />
        <Providers>
          <Header />
          <Drawers />
          {children}
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
