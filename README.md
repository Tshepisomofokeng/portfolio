# Tshepiso. — Portfolio

Static site: no framework, no build step needed to *run* it. Upload the files and it works.

## Files

| File | Purpose |
|---|---|
| `index.html` | The page (semantic HTML, SEO tags, structured data) |
| `style.css` / `action.js` | **Readable source** — edit these |
| `style.min.css` / `action.min.js` | **Production files the page loads** (generated) |
| `build.py` | Regenerates the `.min` files — `python build.py` (Python 3 only, nothing to install) |
| `robots.txt`, `sitemap.xml` | Search-engine files |
| `.htaccess` | Optional Apache tuning: compression, caching, security headers |
| `assets/` | Your images (not included here) |

**Workflow:** edit `style.css` or `action.js` → run `python build.py` → upload.
The build also stamps a content hash into `index.html` (`style.min.css?v=…`), so browsers
pick up changes immediately while unchanged files stay cached.

## Before launch — checklist

1. **Domain:** replace `YOUR-DOMAIN.co.za` with the real domain in `index.html` (canonical, Open Graph,
   structured data — one find-and-replace), `robots.txt` and `sitemap.xml`.
2. **CV button:** point the "Download CV" link at your PDF and add the `download` attribute.
3. **Contact form:** works out of the box by opening the visitor's email app. For real submissions, set
   `data-endpoint="https://formspree.io/f/xxxx"` on the `<form>` (any service that accepts JSON works).
4. **Share image:** add a 1200 × 630 px image and point `og:image` / `twitter:image` at it
   (the portrait is used until then). Compress `assets/*.webp` (aim ≈ 60–100 KB for the portrait).
5. **Images:** add `width` / `height` attributes to the logo and portrait `<img>` tags once you know the sizes.
6. Submit `sitemap.xml` in Google Search Console, then run PageSpeed Insights on the live URL.

## Notes

- **Animation system:** add `data-reveal` (`left`, `right`, `zoom`, `fade`) to any element to have it animate
  in/out on scroll; `data-parallax="0.1"` / `data-zoom="0.05"` for scroll-linked movement. Everything is
  switched off for visitors who prefer reduced motion.
- **Accessibility:** skip link, labelled form fields with inline validation, carousel with pause control,
  visible focus rings, 44px touch targets, WCAG-friendly contrast on interactive states.
- **Icons:** inline SVG sprite from Font Awesome Free (CC BY 4.0) — keep the attribution comment.
