# Diamond Dental — Web Logo Package

Web-ready logo assets, rebuilt as clean vector art. Every file has a
transparent background so it drops onto any page color.

> Note: these are a faithful vector recreation of the supplied logo image,
> not the designer's original artwork. If you can provide the original
> vector (AI/EPS/SVG) or a high-resolution file, the recreation can be
> matched even more precisely.

## Files

### svg/  (scalable, best for the site — use these first)
- `diamond-dental-logo.svg` — full logo, gray wordmark (for light backgrounds)
- `diamond-dental-logo-white.svg` — full logo, white wordmark (for dark backgrounds)
- `diamond-dental-icon.svg` — diamond + tooth mark only

### png/  (transparent raster fallbacks)
- `diamond-dental-logo-400 / 800 / 1600.png` — gray wordmark, 1x / 2x / hi-res
- `diamond-dental-logo-white-400 / 800 / 1600.png` — white wordmark
- `diamond-dental-icon-256 / 512 / 1024.png` — icon only

### webp/  (smaller modern-browser versions of every PNG above)

### favicon/
- `favicon.ico` — multi-size (16/32/48/64)
- `favicon-16 / 32 / 48.png`
- `apple-touch-icon-180.png` — iOS home screen
- `icon-192.png`, `icon-512.png` — PWA / Android

## Usage

Header logo (SVG with PNG fallback):

```html
<img src="/diamond-dental-logo/svg/diamond-dental-logo.svg"
     alt="Diamond Dental" width="280" height="239">
```

Responsive with WebP:

```html
<picture>
  <source srcset="/diamond-dental-logo/webp/diamond-dental-logo-800.webp" type="image/webp">
  <img src="/diamond-dental-logo/png/diamond-dental-logo-800.png"
       alt="Diamond Dental" width="400" height="341">
</picture>
```

Favicons (in `<head>`):

```html
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" type="image/svg+xml" href="/diamond-dental-icon.svg">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">
<link rel="apple-touch-icon" href="/apple-touch-icon-180.png">
```

## Brand color

Diamond gradient runs from magenta `#B81E61` through pink `#E24E8D` to
light pink `#F7BAD6`. A solid brand pink of `#D12C74` works for links and
buttons.
