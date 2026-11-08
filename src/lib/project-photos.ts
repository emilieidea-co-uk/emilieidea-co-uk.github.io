import type { ImageMetadata } from 'astro';
import { validateArtworks } from './artwork-data.mjs';
import { withBase } from './urls';
import { groupArtworks } from './artwork-groups.mjs';
import { renderPhoto, captionFromFilename } from './photos';
import embroideries from '../data/embroideries.json';
import scrapingby from '../data/scrapingby.json';
import artworks from '../data/artworks.json';

export type ProjectCollection = 'embroideries' | 'scrapingby' | 'artworks';
export interface ArtworkEntry {
  id: string;
  postId: string | null;
  imageIndex: number;
  file: string;
  publish: boolean;
  caption: string;
  date: string;
  postUrl: string;
}
export const manifests: Record<ProjectCollection, ArtworkEntry[]> = { embroideries, scrapingby, artworks };
const images = import.meta.glob<{ default: ImageMetadata }>(
  '../assets/{embroideries,scrapingby,artworks}/*.{jpg,jpeg,png,webp,avif,JPG,JPEG,PNG,WEBP,AVIF}',
  { eager: true }
);

export const collectionInfo = {
  artworks: { title: 'Artworks', href: '/' },
  scrapingby: { title: 'ScrapingBy', href: '/scrapingby/' },
  embroideries: { title: 'Embroideries', href: '/embroideries/' },
};
export const artworkPath = (id: string) => withBase(`/artwork/${id}/`);
validateArtworks(manifests, (collection: string, file: string) =>
  Boolean(images[`../assets/${collection}/${file}`]));

export function publishedArtworks() {
  return (Object.keys(manifests) as ProjectCollection[]).flatMap(collection =>
    manifests[collection].filter(entry => entry.publish).map(entry => ({
      ...entry, collection, image: images[`../assets/${collection}/${entry.file}`].default,
    })));
}

export type PublishedArtwork = ReturnType<typeof publishedArtworks>[number];
export interface ArtworkGroup {
  collection: ProjectCollection;
  postId: string | null;
  images: PublishedArtwork[];
}
export function publishedArtworkGroups(): ArtworkGroup[] {
  return groupArtworks(publishedArtworks());
}
export async function renderArtworkGroup(group: ArtworkGroup) {
  return Promise.all(group.images.map(async entry => ({
    ...await renderPhoto(entry.image), id: entry.id, href: artworkPath(entry.id),
    caption: entry.caption, date: entry.date,
    alt: entry.caption.trim().replace(/\s+/g, ' ').slice(0, 160) || captionFromFilename(entry.file),
  })));
}

// Blog images reuse project files and respect the same publication control.
export function projectPhoto(collection: ProjectCollection, filename: string) {
  const entry = manifests[collection].find((item) => item.file === filename);
  if (!entry) throw new Error(`No ${collection} manifest entry for ${filename}`);
  if (entry.publish === false) return undefined;
  const image = images[`../assets/${collection}/${filename}`]?.default;
  if (!image) throw new Error(`Missing ${collection} image: ${filename}`);
  return { image, caption: entry.caption, id: entry.id, href: artworkPath(entry.id) };
}
