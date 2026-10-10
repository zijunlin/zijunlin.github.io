// A preview history entry carries the reading context underneath its overlay.
// Shared links have no source and therefore open over the world itself.
export function readingRoute() {
  if (location.hash !== '#work/platform') return location.hash;
  const source = history.state?.workPreview?.source;
  return ['#about', '#career', '#work', '#notes'].includes(source) ? source : '';
}
