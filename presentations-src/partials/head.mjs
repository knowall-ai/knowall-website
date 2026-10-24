// <!-- @include head {"title": "...", "description": "..."} -->
// The document head up to the shared stylesheets: title, description and the
// Open Graph / Twitter tags (all three take the same text). The deck's own
// <style> block follows it in the source. Values are HTML.
export default function head({ slug, title, description }) {
  const url = `https://www.knowall.ai/presentations/${slug}.html`;
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <!-- Generated from presentations-src/${slug}.html by \`npm run decks:build\`: edit the source, not this file. -->
    <title>${title}</title>
    <meta name="description" content="${description}" />
    <link rel="icon" href="/favicon.ico" type="image/x-icon" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${url}" />
    <meta property="og:image" content="https://www.knowall.ai/opengraph-image.png" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${description}" />
    <meta name="twitter:image" content="https://www.knowall.ai/twitter-image.png" />
    <link rel="stylesheet" href="vendor/reveal/reset.css" />
    <link rel="stylesheet" href="vendor/reveal/reveal.css" />
    <link rel="stylesheet" href="vendor/fonts.css" />
    <link rel="stylesheet" href="knowall-deck.css" />
`;
}
