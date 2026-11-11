export type Category = "Lighting" | "Office" | "Kitchen"

export interface Product {
  id: string
  name: string
  category: Category
  /** Price in cents, so money maths never drifts. */
  priceCents: number
  blurb: string
}

export const PRODUCTS: Product[] = [
  {
    id: "aurora-desk-lamp",
    name: "Aurora Desk Lamp",
    category: "Lighting",
    priceCents: 4200,
    blurb: "Warm, dimmable task light with a matte brass arm and a weighted base.",
  },
  {
    id: "nimbus-floor-lamp",
    name: "Nimbus Floor Lamp",
    category: "Lighting",
    priceCents: 8900,
    blurb: "A tall linen shade that throws soft light into the corner of a room.",
  },
  {
    id: "halo-task-light",
    name: "Halo Task Light",
    category: "Lighting",
    priceCents: 2400,
    blurb: "A small clip-on ring light for desks, shelves and late-night reading.",
  },
  {
    id: "meridian-notebook",
    name: "Meridian Notebook",
    category: "Office",
    priceCents: 1250,
    blurb: "A5, 160 dot-grid pages, lay-flat binding, recycled stock.",
  },
  {
    id: "kestrel-pen-set",
    name: "Kestrel Pen Set",
    category: "Office",
    priceCents: 1800,
    blurb: "Three fine-tip rollerballs in graphite, ink and sand.",
  },
  {
    id: "copper-kettle",
    name: "Copper Pour-Over Kettle",
    category: "Kitchen",
    priceCents: 6400,
    blurb: "A gooseneck spout and a hand-hammered copper body that heats fast.",
  },
]

export const CATEGORIES: Category[] = ["Lighting", "Office", "Kitchen"]

export function formatMoney(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}
