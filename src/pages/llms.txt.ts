import { absoluteUrl } from '../lib/urls';
import type { APIRoute } from 'astro';
import { site as siteInfo, social } from '../config';

// llms.txt — a curated, Markdown index that points AI tools at the most useful
// pages. (Curation, not access control — the crawler stance lives in robots.txt.)
// Spec: https://llmstxt.org/
export const GET: APIRoute = ({ site }) => {
  const url = (path: string) => absoluteUrl(path, site);

  const body = `# ${siteInfo.name}

> ${siteInfo.description} The site has three project galleries, a blog, and a short biography. Content may be cited with attribution; please do not use the images or text to train machine-learning models.

## Projects
- [Artworks](${url('/artworks/')}): pottery, embroidery, and printmaking.
- [ScrapingBy](${url('/scrapingby/')}): scratchboard pieces and their making.
- [Embroideries](${url('/')}): embroidery and stitched work.

## Blog
- [Blog](${url('/blog/')}): notes on projects, process, and everyday discoveries.

## About
- [About](${url('/about/')}): a short biography of ${siteInfo.name}.
- [Contact](${url('/contact/')}): ways to follow and reach out.

## Elsewhere
- Instagram: ${social.instagram}
- GitHub: ${social.github}
`;

  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
