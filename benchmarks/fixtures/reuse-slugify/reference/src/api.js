import { slugify } from './utils.js';

export function titleToSlug(title) {
  return slugify(title);
}
