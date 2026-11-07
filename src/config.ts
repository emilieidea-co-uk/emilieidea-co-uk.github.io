import { withBase } from './lib/urls';

// ────────────────────────────────────────────────────────────────────────────
//  Site configuration — edit these values to make the template your own.
//  Almost everything visitor-facing (titles, the brand, SEO, JSON-LD, llms.txt)
//  is derived from this file, so start here.
// ────────────────────────────────────────────────────────────────────────────

export interface NavItem {
  label: string;
  href: string;
}

export const site = {
  name: 'EmilieIdea',
  // Optional second-script name (e.g. a Chinese 中文名) shown under the brand and
  // in a couple of prose pages. Leave it '' to hide it everywhere. See the README
  // for how to self-host a font subset so it renders identically on every device.
  nameZh: '',
  title: 'EmilieIdea',
  description:
    'Artworks, ScrapingBy, Embroideries I, and Embroideries II — projects and a blog.',
};

// Left-hand navigation. Embroideries I is the home page.
export const nav: NavItem[] = [
  { label: 'Artworks', href: withBase('/artworks/') },
  { label: 'ScrapingBy', href: withBase('/scrapingby/') },
  { label: 'Embroideries I', href: withBase('/') },
  { label: 'Embroideries II', href: withBase('/embroideries2/') },
  { label: 'Blog', href: withBase('/blog/') },
  { label: 'About', href: withBase('/about/') },
  { label: 'Contact', href: withBase('/contact/') },
];

// Social / external links shown in the sidebar and on the contact page. Replace
// the placeholders with your own. If you drop or add one, also update the
// matching <Icon> in Sidebar.astro and the list in Contact.astro.
export const social = {
  instagram: 'https://www.instagram.com/emilieidea_zugou',
  github: 'https://github.com/emilieidea-co-uk',
};
