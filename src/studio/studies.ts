// Curated SVG paths, in a shared 600 × 440 drawing space. Each contour has
// its own path so the sampler never joins unrelated parts with a new line.
export interface StudyShape { contours: string[]; filled: boolean }
export interface Study { id: string; title: string; description: string; shapes: StudyShape[] }
export const WIDTH = 600;
export const HEIGHT = 440;

export const studies: Study[] = [
  {
    id: 'petals', title: 'Petal medallion',
    description: 'A circular boundary with an open centre. Explore curved, repeating stitches inspired by the geometric guide in Emilie’s work.',
    shapes: [{ filled: true, contours: [
      'M 480 220 A 180 180 0 1 1 120 220 A 180 180 0 1 1 480 220 Z',
      'M 329 220 A 29 29 0 1 1 271 220 A 29 29 0 1 1 329 220 Z',
    ] }],
  },
  {
    id: 'flower', title: 'Flower',
    description: 'A flower silhouette and a separate stem. The filled flower receives a pattern; the unfilled stem becomes running stitches.',
    shapes: [
      { filled: true, contours: [
        'M 300 205 C 208 161 200 82 244 69 C 279 57 297 104 300 126 C 303 91 338 55 369 76 C 404 101 366 160 331 182 C 389 158 447 182 435 220 C 423 255 369 244 334 229 C 380 274 371 322 336 321 C 307 319 301 273 300 250 C 284 301 245 323 224 295 C 203 265 242 235 269 221 C 211 239 163 213 177 183 C 189 155 248 175 300 205 Z',
        'M 319 207 A 19 19 0 1 1 281 207 A 19 19 0 1 1 319 207 Z',
      ] },
      { filled: false, contours: ['M 300 322 C 300 352 292 379 278 402', 'M 293 368 Q 241 331 232 359 Q 254 385 293 368'] },
    ],
  },
  {
    id: 'horse', title: 'Horse silhouette',
    description: 'A study drawing inspired by fabric horses, with an open outline for the face and a patterned body. This is a new study, not a tracing of an original artwork.',
    shapes: [
      { filled: true, contours: ['M 149 196 L 131 136 L 158 80 L 184 117 L 204 78 L 217 132 L 244 173 Q 330 192 431 168 L 466 137 L 493 146 L 473 181 L 458 209 L 451 353 L 413 353 L 401 270 L 248 271 L 225 353 L 186 353 L 187 231 L 157 218 L 113 227 L 99 207 Z'] },
      { filled: false, contours: ['M 155 159 Q 164 154 171 160', 'M 114 207 L 145 206', 'M 222 141 Q 229 157 245 173'] },
    ],
  },
];

export function studySvg(study: Study): string {
  const paths = study.shapes.map(shape => `<path d="${shape.contours.join(' ')}" fill="${shape.filled ? '#d0d0d0' : 'none'}" fill-rule="evenodd" stroke="#33332e" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" aria-label="${study.title} study drawing">${paths}</svg>`;
}
