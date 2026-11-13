import type { APIRoute } from 'astro';
import { studies } from '../../../../../studio/studies';
import { generateStudioShare } from '../../../../../../scripts/generate-studio-share.mjs';

export function getStaticPaths() {
  return studies.map(study => ({ params: { drawing: study.id }, props: { study } }));
}

// Emitted as an ordinary PNG at build time; no image service runs in production.
export const GET: APIRoute = async ({ props }) => new Response(
  new Uint8Array(await generateStudioShare(props.study)),
  { headers: { 'Content-Type': 'image/png' } },
);
