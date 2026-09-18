// The launch catalog, copied from the storefront's original static data.
// Prices are whole dollars here and stored as cents in the database.

export interface SeedVariant {
  id: string;
  name: string;
  hex: string;
  image: string;
  stock: number;
  undertone: "cool" | "warm" | "neutral";
  intensity: "subtle" | "bold";
}

export interface SeedProduct {
  id: string;
  name: string;
  category: string;
  tagline: string;
  description: string;
  price: number;
  specs: string[];
  color: string;
  image: string;
  showcase?: string[];
  stock?: number;
  isHero?: boolean;
  details: { ingredients: string; skinTypes: string[]; size: string; usage: string };
  related: string[];
  variants?: SeedVariant[];
}

export const seedProducts: SeedProduct[] = [
  {
    id: "dawn-cleanse",
    name: "Dawn Cleanse",
    category: "Cleanser",
    tagline: "A quiet start.",
    description:
      "Cream-gel cleanser that lifts residue without stripping. Rinses clean, leaves nothing behind.",
    price: 28,
    specs: ["Cleanser", "150ml", "All skin types"],
    color: "#E8C4B8",
    image: "/products/dawn-cleanse.jpg",
    showcase: [
      "/showcase/dawn-cleanse-1.jpg",
      "/products/dawn-cleanse.jpg",
      "/showcase/dawn-cleanse-3.jpg",
    ],
    stock: 24,
    details: {
      ingredients:
        "Water, Glycerin, Coco-Glucoside, Sodium Cocoyl Isethionate, Panthenol, Aloe Barbadensis Leaf Juice, Allantoin, Sodium PCA, Citric Acid, Ethylhexylglycerin.",
      skinTypes: ["Normal", "Dry", "Combination", "Oily", "Sensitive"],
      size: "150ml / 5.07 fl oz",
      usage:
        "Massage a small amount onto damp skin, morning and evening. Rinse with lukewarm water. Pat dry.",
    },
    related: ["golden-hour-serum", "second-skin-cream", "veil-spf"],
  },
  {
    id: "golden-hour-serum",
    name: "Golden Hour Serum",
    category: "Serum",
    tagline: "The one that started it.",
    description:
      "Ten actives, one bottle. Formulated to brighten, plump, and even tone — without the nine-step routine.",
    price: 58,
    specs: ["Serum", "30ml", "All skin types"],
    color: "#C9A876",
    image: "/products/golden-hour-serum.jpg",
    showcase: [
      "/showcase/golden-hour-serum-1.jpg",
      "/products/golden-hour-serum.jpg",
      "/showcase/golden-hour-serum-3.jpg",
    ],
    stock: 3,
    isHero: true,
    details: {
      ingredients:
        "Water, Niacinamide, Sodium Hyaluronate, Glycerin, Ascorbyl Glucoside, Squalane, Panthenol, Tocopherol, Ferulic Acid, Propanediol, Xanthan Gum, Phenoxyethanol.",
      skinTypes: ["Normal", "Dry", "Combination", "Oily", "Sensitive"],
      size: "30ml / 1.01 fl oz",
      usage:
        "Press two to three drops onto clean skin, morning or evening, before moisturizer. Pat in rather than rubbing.",
    },
    related: ["dawn-cleanse", "second-skin-cream", "veil-spf"],
  },
  {
    id: "second-skin-cream",
    name: "Second Skin Cream",
    category: "Moisturizer",
    tagline: "Weightless, not empty.",
    description:
      "A barrier cream that disappears on contact. Locks in moisture for twenty-four hours without sitting heavy.",
    price: 42,
    specs: ["Moisturizer", "50ml", "All skin types"],
    color: "#EDE0D4",
    image: "/products/second-skin-cream.jpg",
    showcase: [
      "/showcase/second-skin-cream-1.jpg",
      "/products/second-skin-cream.jpg",
      "/showcase/second-skin-cream-3.jpg",
    ],
    stock: 12,
    details: {
      ingredients:
        "Water, Squalane, Glycerin, Ceramide NP, Cholesterol, Butyrospermum Parkii Butter, Cetearyl Alcohol, Sodium Hyaluronate, Panthenol, Tocopherol, Phenoxyethanol.",
      skinTypes: ["Normal", "Dry", "Combination", "Sensitive"],
      size: "50ml / 1.7 fl oz",
      usage:
        "Warm a pea-sized amount between your fingertips and press over face and neck after serum. Morning and night.",
    },
    related: ["golden-hour-serum", "veil-spf", "freyya-balm"],
  },
  {
    id: "veil-spf",
    name: "Veil SPF",
    category: "SPF",
    tagline: "No white cast. No excuses.",
    description:
      "Broad-spectrum SPF 50 that wears like nothing. Sits under makeup, holds up in the sun.",
    price: 36,
    specs: ["SPF 50", "40ml", "All skin types"],
    color: "#F4E9DD",
    image: "/products/veil-spf.jpg",
    stock: 40,
    details: {
      ingredients:
        "Zinc Oxide, Water, Squalane, Niacinamide, Caprylic/Capric Triglyceride, Glycerin, Silica, Tocopherol, Polyglyceryl-3 Polyricinoleate.",
      skinTypes: ["Normal", "Dry", "Combination", "Oily", "Sensitive"],
      size: "40ml / 1.35 fl oz",
      usage:
        "Apply generously as the last step of your morning routine — two finger-lengths for face and neck. Reapply every two hours in direct sun.",
    },
    related: ["second-skin-cream", "dew-drops", "freyya-balm"],
  },
  {
    id: "freyya-balm",
    name: "Freyya Balm",
    category: "Lip Balm",
    tagline: "Color, barely there.",
    description:
      "A balm first, a tint second. Buildable color that feels like nothing on.",
    price: 24,
    specs: ["Lip Balm", "4.5g", "4 shades"],
    color: "#B97572",
    image: "/products/freyya-balm-bare.jpg",
    details: {
      ingredients:
        "Ricinus Communis Seed Oil, Butyrospermum Parkii Butter, Cera Alba, Squalane, Helianthus Annuus Seed Oil, Tocopherol, Mica, Iron Oxides.",
      skinTypes: ["All skin types"],
      size: "4.5g / 0.16 oz",
      usage:
        "Swipe over bare lips. Layer for more depth, or wear a single pass for a sheer wash of color. Reapply as needed.",
    },
    related: ["dew-drops", "veil-spf", "second-skin-cream"],
    variants: [
      { id: "bare", name: "Bare", hex: "#D8A798", image: "/products/freyya-balm-bare.jpg", stock: 18, undertone: "neutral", intensity: "subtle" },
      { id: "petal", name: "Petal", hex: "#E8B4B8", image: "/products/freyya-balm-petal.jpg", stock: 4, undertone: "cool", intensity: "subtle" },
      { id: "rosewood", name: "Rosewood", hex: "#B97572", image: "/products/freyya-balm-rosewood.jpg", stock: 9, undertone: "cool", intensity: "bold" },
      { id: "terracotta", name: "Terracotta", hex: "#C1694F", image: "/products/freyya-balm-terracotta.jpg", stock: 2, undertone: "warm", intensity: "bold" },
    ],
  },
  {
    id: "dew-drops",
    name: "Dew Drops",
    category: "Highlighter",
    tagline: "Light, not glitter.",
    description:
      "Liquid drops that melt into skin for a lit-from-within finish. Wear alone or mixed into moisturizer.",
    price: 32,
    specs: ["Highlighter", "15ml", "4 shades"],
    color: "#D4B483",
    image: "/products/dew-drops-moonlight.jpg",
    details: {
      ingredients:
        "Caprylic/Capric Triglyceride, Squalane, Mica, Silica, Synthetic Fluorphlogopite, Tocopherol, Titanium Dioxide, Iron Oxides.",
      skinTypes: ["Normal", "Dry", "Combination"],
      size: "15ml / 0.51 fl oz",
      usage:
        "Press one to two drops onto the cheekbones, brow bone and bridge of the nose, or mix a drop into moisturizer. Blend with fingertips.",
    },
    related: ["freyya-balm", "veil-spf", "golden-hour-serum"],
    variants: [
      { id: "moonlight", name: "Moonlight", hex: "#F0EAE2", image: "/products/dew-drops-moonlight.jpg", stock: 11, undertone: "cool", intensity: "subtle" },
      { id: "champagne", name: "Champagne", hex: "#D4B483", image: "/products/dew-drops-champagne.jpg", stock: 5, undertone: "warm", intensity: "subtle" },
      { id: "rose-gold", name: "Rose Gold", hex: "#D9A996", image: "/products/dew-drops-rose-gold.jpg", stock: 3, undertone: "neutral", intensity: "bold" },
      { id: "bronze", name: "Bronze", hex: "#A97452", image: "/products/dew-drops-bronze.jpg", stock: 8, undertone: "warm", intensity: "bold" },
    ],
  },
];
