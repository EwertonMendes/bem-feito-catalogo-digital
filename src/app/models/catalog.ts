export type CollectionId = 'classica' | 'mais-aroma';
export type VisualSection = 'home' | 'fragrances' | 'essence' | 'process' | 'contact';

export interface FragranceAssets {
  desktopHero: string;
  mobileHero: string;
  desktopBackground: string;
  mobileBackground: string;
  avatar: string;
  detail: string;
}

export interface Fragrance {
  id: string;
  name: string;
  collection: CollectionId;
  collectionLabel: string;
  description: string;
  family: string;
  aroma: string;
  feeling: string;
  colors: { ink: string; accent: string; vignette: string; ambient: string };
  availableFormats: string[];
  images: FragranceAssets;
}

export interface ProductFormat {
  id: string;
  name: string;
  weight: string;
  prices: Record<CollectionId, number>;
}

export interface Catalog {
  brand: { name: string; tagline: string; instagram: string; logo: string };
  config: { disclaimer: string; defaultFormat: string };
  formats: ProductFormat[];
  fragrances: Fragrance[];
}
