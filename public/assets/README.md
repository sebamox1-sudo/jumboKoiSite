# Koi assets — `public/assets/`

Drop the **cut-out koi** here (transparent background, PNG or WebP).
Files served from `/public` are reachable at the site root, so the path in
`Collection.jsx` (`assets/koi-*.webp`, resolved via `import.meta.env.BASE_URL`)
maps 1:1 to the files below.

Expected filenames (must match `MOCK_DATA` in `src/components/Collection/Collection.jsx`):

| id                 | variety | kanji | file                  |
| ------------------ | ------- | ----- | --------------------- |
| kohaku-yamamatsu   | Kohaku  | 紅白  | `koi-kohaku.webp`     |
| sanke-omosako      | Sanke   | 三色  | `koi-sanke.webp`      |
| showa-dainichi     | Showa   | 昭和  | `koi-showa.webp`      |
| tancho-sakai       | Tancho  | 丹頂  | `koi-tancho.webp`     |
| asagi-ogata        | Asagi   | 浅黄  | `koi-asagi.webp`      |

Tips for the "living jewel / break-out" look:
- **Transparent background** (no white box) so the fish floats in the void.
- **Vertical framing** — the card is ~9:16; a head-up / diagonal koi reads best.
- Trim tight to the silhouette; the image is `object-fit: contain` and bleeds
  ~30% past the card sides, so leave no empty padding baked into the file.
