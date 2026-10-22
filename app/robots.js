export default function robots() {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/private/', '/api/', '/admin/', '/account/', '/cart'],
    },
    sitemap: 'https://pubesto.com/sitemap.xml',
  }
}
