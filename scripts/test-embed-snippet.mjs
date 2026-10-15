// Direct test for the embed-snippet builder. No server needed;
// we import the TS via the JS path that `tsx`/node can resolve.
// The test asserts the exact spec'd format.
import { buildEmbedSnippet } from "../lib/embed-snippet.ts";

function assert(cond, msg) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  } else {
    console.log(`ok  : ${msg}`);
  }
}

const expected =
  '<script async type="text/javascript" src="https://testimonial.to/js/widget-embed.js"></script>\n' +
  '<div class="testimonial-to-embed" data-url="https://embed-v2.testimonial.to/w/product-hunt-reviews?id=w_aliceph01" data-height="800px" style="height:800px"></div>\n';

const actual = buildEmbedSnippet({
  publicSlug: "product-hunt-reviews",
  widgetId: "w_aliceph01",
});

assert(
  actual === expected,
  `default snippet matches spec (got ${JSON.stringify(actual)})`,
);
assert(
  actual.startsWith('<script async type="text/javascript" src="https://testimonial.to/js/widget-embed.js"></script>'),
  "script tag is the first line",
);
assert(
  actual.includes('class="testimonial-to-embed"'),
  "div has the testimonial-to-embed class",
);
assert(
  actual.includes('data-url="https://embed-v2.testimonial.to/w/product-hunt-reviews?id=w_aliceph01"'),
  "data-url uses /w/<slug>?id=<widgetId>",
);
assert(
  actual.includes('data-height="800px"'),
  "data-height defaults to 800px",
);
assert(
  actual.includes('style="height:800px"'),
  "inline style matches data-height",
);
assert(
  actual.endsWith("\n"),
  "snippet ends with a single trailing newline",
);

// Custom height
const custom = buildEmbedSnippet({
  publicSlug: "acme",
  widgetId: "w_abc123",
  height: "1200px",
});
assert(
  custom.includes('data-height="1200px"'),
  "custom height is rendered",
);
assert(
  custom.includes('style="height:1200px"'),
  "custom height matches inline style",
);

// Different slug/widgetId values land in the data-url
const tagged = buildEmbedSnippet({
  publicSlug: "beta-testers",
  widgetId: "w_xyz987",
});
assert(
  tagged.includes('data-url="https://embed-v2.testimonial.to/w/beta-testers?id=w_xyz987"'),
  "data-url interpolates slug + widgetId",
);

console.log("\nEmbed snippet: all assertions passed.");
