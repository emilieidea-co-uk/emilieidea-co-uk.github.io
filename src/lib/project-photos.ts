import type { ImageMetadata } from 'astro';
import embroideries from '../data/embroideries.json';
import scrapingby from '../data/scrapingby.json';
import artworks from '../data/artworks.json';

export type ProjectCollection = 'embroideries' | 'scrapingby' | 'artworks';
const manifests = { embroideries, scrapingby, artworks };
const images = import.meta.glob<{ default: ImageMetadata }>(
  '../assets/{embroideries,scrapingby,artworks}/*.{jpg,jpeg,png,webp,avif,JPG,JPEG,PNG,WEBP,AVIF}',
  { eager: true }
);

// Blog images reuse project files and respect the same publication control.
export function projectPhoto(collection: ProjectCollection, filename: string) {
  const entry = manifests[collection].find((item) => item.file === filename);
  if (!entry) throw new Error(`No ${collection} manifest entry for ${filename}`);
  if (entry.publish === false) return undefined;
  const image = images[`../assets/${collection}/${filename}`]?.default;
  if (!image) throw new Error(`Missing ${collection} image: ${filename}`);
  return { image, caption: entry.caption };
}
