// <!-- @include head {"title": "...", "description": "..."} -->
// The document head up to the shared stylesheets: title, description and the
// Open Graph / Twitter tags (all three take the same text). The share image is
// the deck's own: images/og/<slug>.jpg, 1200x630, framed like its gallery tile
// (the build fails if it is missing). The deck's own <style> block follows it
// in the source. Values are HTML.
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export default function head({ slug, title, description }) {
  const url = `https://www.knowall.ai/presentations/${slug}.html`;
  const ogFile = fileURLToPath(
    new URL(`../../public/presentations/images/og/${slug}.jpg`, import.meta.url)
  );
  if (!existsSync(ogFile))
    throw new Error(
      `head: no share image for ${slug} (public/presentations/images/og/${slug}.jpg)`
    );
  const image = `https://www.knowall.ai/presentations/images/og/${slug}.jpg`;
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
    <meta property="og:image" content="${image}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="${title}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${description}" />
    <meta name="twitter:image" content="${image}" />
    <link rel="stylesheet" href="vendor/reveal/reset.css" />
    <link rel="stylesheet" href="vendor/reveal/reveal.css" />
    <link rel="stylesheet" href="vendor/fonts.css" />
    <link rel="stylesheet" href="knowall-deck.css" />
`;
}
