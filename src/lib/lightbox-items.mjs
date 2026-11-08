// One gallery cover can supply several slides; ordinary blog tiles stay single.
export function lightboxItems(tiles) {
  return tiles.flatMap(tile => {
    const group = tile.dataset.photoGroup ? JSON.parse(tile.dataset.photoGroup) : null;
    if (!Array.isArray(group) || !group.length) return [{ tile, slide: null, position: 1, count: 1 }];
    return group.map((slide, index) => ({ tile, slide, position: index + 1, count: group.length }));
  });
}
