# Request-card font fallback

The owner's reference is https://www.mac.gov.tw/cn/ (inspected 2026-10-30).
Its body uses Arial and Microsoft JhengHei (微軟正黑體), weight 400. The card
prioritizes these system fonts, then PingFang TC on Apple platforms. It does
not convert Simplified Chinese content to Traditional Chinese.

Noto Sans TC, licensed under the included SIL OFL 1.1, provides a self-hosted
Traditional Chinese sans-serif fallback on other devices. Microsoft and Apple
font binaries are not redistributed. The reference site's workaround for three
specific glyphs is not needed for our fallback and is not copied.

`source.json` pins the downloaded upstream binary and SHA-256. Regenerate with
`node scripts/assets/vendor-card-font.mjs` from the repository root. All 20,745
upstream character mappings are retained in Unicode-range WOFF2 subsets, so
future live requests are covered independently of the published snapshot.
Normal builds require no network access. Only pages containing the visible
Firebase card load the stylesheet; browsers load only the subsets they need.
