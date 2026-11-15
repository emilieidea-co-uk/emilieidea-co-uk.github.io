// Shared reference for the Studio landing page and drawings without their own post.
export const studioReference = {
  collection: 'scrapingby' as const,
  file: 'eco_zhonglaise_2021-11-13_CWO3doINYa7_01.jpg',
  originalPost: '/artwork/instagram-CWO3doINYa7-01/',
};

export function originalPostForStudy(study: { originalPost?: string }): string {
  return study.originalPost ?? studioReference.originalPost;
}
