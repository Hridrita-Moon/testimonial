/**
 * Build the public embed snippet for a widget.
 *
 * The format is fixed by the embed-script contract:
 *
 *   <script async type="text/javascript" src="https://testimonial.to/js/widget-embed.js"></script>
 *   <div class="testimonial-to-embed" data-url="https://embed-v2.testimonial.to/w/<slug>?id=<widgetId>" data-height="<height>" style="height:<height>"></div>
 *
 * The script and the div are emitted verbatim. `height` defaults to
 * `800px`; any other value must include a unit (the embed script
 * reads it as a CSS length).
 *
 * Output ends with a single trailing newline so a `paste` into a
 * code block keeps a clean trailing line.
 */

export interface EmbedSnippetInput {
  publicSlug: string;
  widgetId: string;
  height?: string;
}

export function buildEmbedSnippet(input: EmbedSnippetInput): string {
  const height = input.height ?? "800px";
  return [
    '<script async type="text/javascript" src="https://testimonial.to/js/widget-embed.js"></script>',
    `<div class="testimonial-to-embed" data-url="https://embed-v2.testimonial.to/w/${input.publicSlug}?id=${input.widgetId}" data-height="${height}" style="height:${height}"></div>`,
    "",
  ].join("\n");
}
