export const loaders = {
  'am': () => import('../catalogs/am.json', { with: { type: 'json' } }),
  'ar': () => import('../catalogs/ar.json', { with: { type: 'json' } }),
  'bn': () => import('../catalogs/bn.json', { with: { type: 'json' } }),
  'bho': () => import('../catalogs/bho.json', { with: { type: 'json' } }),
  'en-US': () => import('../catalogs/en-US.json', { with: { type: 'json' } }),
};
