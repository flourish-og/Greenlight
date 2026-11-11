import { useMemo, useState } from "react"
import { CATEGORIES, PRODUCTS, formatMoney, type Category, type Product } from "./data/products"

type View = "catalog" | "product" | "cart" | "checkout" | "confirmation"

interface CartLine {
  productId: string
  qty: number
}

interface Order {
  number: string
  name: string
  totalCents: number
  giftWrap: boolean
}

interface CheckoutFields {
  name: string
  email: string
  address: string
  city: string
  postalCode: string
}

const EMPTY_FIELDS: CheckoutFields = { name: "", email: "", address: "", city: "", postalCode: "" }

/** Percent off, keyed by the code the shopper types (case-insensitive). */
const PROMO_CODES: Record<string, number> = {
  GREENLIGHT10: 10,
}

/** Flat-rate shipping, waived once the discounted subtotal reaches the threshold. */
const SHIPPING_CENTS = 599
const FREE_SHIPPING_THRESHOLD_CENTS = 7500

/** Optional gift wrap, charged per order and never counted toward free shipping. */
const GIFT_WRAP_CENTS = 400

let nextOrderNumber = 1001

function productById(id: string): Product {
  const product = PRODUCTS.find((candidate) => candidate.id === id)
  if (!product) throw new Error(`Unknown product: ${id}`)
  return product
}

export default function App() {
  const [view, setView] = useState<View>("catalog")
  const [query, setQuery] = useState("")
  const [category, setCategory] = useState<Category | "All">("All")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [cart, setCart] = useState<CartLine[]>([])
  const [fields, setFields] = useState<CheckoutFields>(EMPTY_FIELDS)
  const [errors, setErrors] = useState<Partial<Record<keyof CheckoutFields, string>>>({})
  const [order, setOrder] = useState<Order | null>(null)
  const [promoInput, setPromoInput] = useState("")
  const [appliedPromo, setAppliedPromo] = useState<string | null>(null)
  const [promoError, setPromoError] = useState("")
  const [giftWrap, setGiftWrap] = useState(false)

  const visibleProducts = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return PRODUCTS.filter((product) => {
      const matchesCategory = category === "All" || product.category === category
      const matchesQuery =
        needle.length === 0 ||
        product.name.toLowerCase().includes(needle) ||
        product.category.toLowerCase().includes(needle) ||
        product.blurb.toLowerCase().includes(needle)
      return matchesCategory && matchesQuery
    })
  }, [query, category])

  const itemCount = cart.reduce((total, line) => total + line.qty, 0)
  const subtotalCents = cart.reduce((total, line) => total + productById(line.productId).priceCents * line.qty, 0)
  const discountPercent = appliedPromo ? (PROMO_CODES[appliedPromo] ?? 0) : 0
  const discountCents = Math.round((subtotalCents * discountPercent) / 100)
  const discountedSubtotalCents = subtotalCents - discountCents
  const shippingCents =
    discountedSubtotalCents === 0 || discountedSubtotalCents >= FREE_SHIPPING_THRESHOLD_CENTS ? 0 : SHIPPING_CENTS
  const giftWrapCents = giftWrap ? GIFT_WRAP_CENTS : 0
  const totalCents = discountedSubtotalCents + shippingCents + giftWrapCents
  const selected = selectedId ? productById(selectedId) : null

  function applyPromo(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const code = promoInput.trim().toUpperCase()
    if (PROMO_CODES[code] !== undefined) {
      setAppliedPromo(code)
      setPromoError("")
      return
    }
    setAppliedPromo(null)
    setPromoError("That promo code is not valid")
  }

  function addToCart(productId: string) {
    setCart((current) => {
      const existing = current.find((line) => line.productId === productId)
      if (existing) {
        return current.map((line) => (line.productId === productId ? { ...line, qty: line.qty + 1 } : line))
      }
      return [...current, { productId, qty: 1 }]
    })
  }

  function setQuantity(productId: string, qty: number) {
    setCart((current) =>
      qty <= 0
        ? current.filter((line) => line.productId !== productId)
        : current.map((line) => (line.productId === productId ? { ...line, qty } : line)),
    )
  }

  function openProduct(productId: string) {
    setSelectedId(productId)
    setView("product")
  }

  function startCheckout() {
    if (cart.length === 0) {
      setView("cart")
      return
    }
    setFields(EMPTY_FIELDS)
    setErrors({})
    setView("checkout")
  }

  function placeOrder(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextErrors: Partial<Record<keyof CheckoutFields, string>> = {}
    if (!fields.name.trim()) nextErrors.name = "Full name is required"
    if (!fields.email.trim()) nextErrors.email = "Email is required"
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email.trim()))
      nextErrors.email = "Enter a valid email address"
    if (!fields.address.trim()) nextErrors.address = "Address is required"
    if (!fields.city.trim()) nextErrors.city = "City is required"
    if (!fields.postalCode.trim()) nextErrors.postalCode = "Postal code is required"

    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    const number = `GL-${nextOrderNumber++}`
    setOrder({ number, name: fields.name.trim(), totalCents, giftWrap })
    setCart([])
    setAppliedPromo(null)
    setPromoInput("")
    setPromoError("")
    setGiftWrap(false)
    setView("confirmation")
  }

  const cartButtonLabel = `Cart (${itemCount})`

  return (
    <div className="app">
      <header className="topbar">
        <button className="brand" onClick={() => setView("catalog")} aria-label="Greenlight Store home">
          <span className="brand-mark" aria-hidden="true" />
          Greenlight Store
        </button>
        <nav className="topbar-actions">
          <button className="link" onClick={() => setView("catalog")}>
            Shop
          </button>
          <button className="cart-button" onClick={() => setView("cart")} data-testid="cart-button">
            {cartButtonLabel}
          </button>
        </nav>
      </header>

      <main>
        {view === "catalog" && (
          <section aria-labelledby="catalog-heading">
            <h1 id="catalog-heading">Small goods for focused rooms</h1>
            <p className="lede">
              Six things we actually use. No carousel, no countdown timer, no dark patterns.
            </p>

            <div className="filters">
              <label className="search">
                <span>Search</span>
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search products"
                  aria-label="Search products"
                />
              </label>
              <div className="chips" role="group" aria-label="Filter by category">
                {(["All", ...CATEGORIES] as const).map((option) => (
                  <button
                    key={option}
                    className={option === category ? "chip chip-active" : "chip"}
                    aria-pressed={option === category}
                    onClick={() => setCategory(option)}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>

            <p className="result-count" data-testid="result-count">
              Showing {visibleProducts.length} of {PRODUCTS.length} products
            </p>

            {visibleProducts.length === 0 ? (
              <p className="empty">No products match “{query}”. Try a different search.</p>
            ) : (
              <ul className="grid">
                {visibleProducts.map((product) => (
                  <li key={product.id} className="card" data-testid="product-card">
                    <button className="card-open" onClick={() => openProduct(product.id)}>
                      <span className="card-name">{product.name}</span>
                      <span className="card-category">{product.category}</span>
                    </button>
                    <p className="price" data-testid="product-price">
                      {formatMoney(product.priceCents)}
                    </p>
                    <button className="primary" aria-label={`Add ${product.name} to cart`} onClick={() => addToCart(product.id)}>
                      Add to cart
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {view === "product" && selected && (
          <section className="detail" aria-labelledby="product-heading">
            <button className="link back" onClick={() => setView("catalog")}>
              ← Back to shop
            </button>
            <h1 id="product-heading">{selected.name}</h1>
            <p className="card-category">{selected.category}</p>
            <p className="price price-large">{formatMoney(selected.priceCents)}</p>
            <p className="blurb">{selected.blurb}</p>
            <button
              className="primary"
              aria-label={`Add ${selected.name} to cart`}
              onClick={() => {
                addToCart(selected.id)
                setView("cart")
              }}
            >
              Add to cart
            </button>
          </section>
        )}

        {view === "cart" && (
          <section aria-labelledby="cart-heading">
            <h1 id="cart-heading">Your cart</h1>
            {cart.length === 0 ? (
              <p className="empty" data-testid="cart-empty">
                Your cart is empty.
              </p>
            ) : (
              <>
                <table className="cart-table">
                  <thead>
                    <tr>
                      <th scope="col">Item</th>
                      <th scope="col">Price</th>
                      <th scope="col">Quantity</th>
                      <th scope="col">Remove</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cart.map((line) => {
                      const product = productById(line.productId)
                      return (
                        <tr key={line.productId} data-testid="cart-line">
                          <td>{product.name}</td>
                          <td>{formatMoney(product.priceCents)}</td>
                          <td>
                            <div className="stepper">
                              <button
                                className="step"
                                aria-label={`Decrease quantity for ${product.name}`}
                                onClick={() => setQuantity(line.productId, line.qty - 1)}
                              >
                                −
                              </button>
                              <span className="qty" data-testid="cart-qty">
                                {line.qty}
                              </span>
                              <button
                                className="step"
                                aria-label={`Increase quantity for ${product.name}`}
                                onClick={() => setQuantity(line.productId, line.qty + 1)}
                              >
                                +
                              </button>
                            </div>
                          </td>
                          <td>
                            <button
                              className="link danger"
                              aria-label={`Remove ${product.name}`}
                              onClick={() => setQuantity(line.productId, 0)}
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                <div className="cart-footer">
                  <div className="cart-totals">
                    <p className="subtotal" data-testid="subtotal">
                      Subtotal: {formatMoney(subtotalCents)}
                    </p>
                    {appliedPromo && (
                      <p className="promo-line" data-testid="promo-discount">
                        Promo discount: -{formatMoney(discountCents)}
                      </p>
                    )}
                    <p className="promo-line" data-testid="shipping-line">
                      Shipping: {shippingCents === 0 ? "Free" : formatMoney(shippingCents)}
                    </p>
                    {giftWrap && (
                      <p className="promo-line" data-testid="gift-wrap-line">
                        Gift wrap: {formatMoney(giftWrapCents)}
                      </p>
                    )}
                    <p className="cart-total" data-testid="cart-total">
                      Total: {formatMoney(totalCents)}
                    </p>
                    <label className="gift-wrap">
                      <input
                        type="checkbox"
                        checked={giftWrap}
                        onChange={(event) => setGiftWrap(event.target.checked)}
                      />
                      Add gift wrap (+{formatMoney(GIFT_WRAP_CENTS)})
                    </label>
                  </div>
                  <form className="promo-form" onSubmit={applyPromo} noValidate>
                    <label htmlFor="promo">Promo code</label>
                    <div className="promo-row">
                      <input
                        id="promo"
                        name="promo"
                        value={promoInput}
                        placeholder="Promo code"
                        aria-label="Promo code"
                        onChange={(event) => {
                          setPromoInput(event.target.value)
                          setPromoError("")
                        }}
                      />
                      <button className="secondary" type="submit">
                        Apply promo code
                      </button>
                    </div>
                    {appliedPromo && (
                      <p className="promo-ok" role="status" data-testid="promo-status">
                        Promo code {appliedPromo} applied
                      </p>
                    )}
                    {promoError && (
                      <p className="error" role="alert" data-testid="promo-error">
                        {promoError}
                      </p>
                    )}
                  </form>
                  <button className="primary" onClick={startCheckout}>
                    Checkout
                  </button>
                </div>
              </>
            )}
          </section>
        )}

        {view === "checkout" && (
          <section className="checkout" aria-labelledby="checkout-heading">
            <h1 id="checkout-heading">Checkout</h1>
            <form onSubmit={placeOrder} noValidate>
              <Field
                id="name"
                label="Full name"
                value={fields.name}
                error={errors.name}
                onChange={(value) => setFields({ ...fields, name: value })}
              />
              <Field
                id="email"
                label="Email"
                type="email"
                value={fields.email}
                error={errors.email}
                onChange={(value) => setFields({ ...fields, email: value })}
              />
              <Field
                id="address"
                label="Address"
                value={fields.address}
                error={errors.address}
                onChange={(value) => setFields({ ...fields, address: value })}
              />
              <Field
                id="city"
                label="City"
                value={fields.city}
                error={errors.city}
                onChange={(value) => setFields({ ...fields, city: value })}
              />
              <Field
                id="postalCode"
                label="Postal code"
                value={fields.postalCode}
                error={errors.postalCode}
                onChange={(value) => setFields({ ...fields, postalCode: value })}
              />

              <div className="checkout-lines">
                <p className="promo-line">
                  Shipping: {shippingCents === 0 ? "Free" : formatMoney(shippingCents)}
                </p>
                {giftWrap && <p className="promo-line">Gift wrap: {formatMoney(giftWrapCents)}</p>}
              </div>
              <p className="order-total" data-testid="order-total">
                Order total: {formatMoney(totalCents)}
              </p>
              <button className="primary" type="submit">
                Place order
              </button>
            </form>
          </section>
        )}

        {view === "confirmation" && order && (
          <section className="confirmation" aria-labelledby="confirmation-heading">
            <h1 id="confirmation-heading">Order confirmed</h1>
            <p className="lede">Thank you, {order.name}. We are packing it now.</p>
            <p className="order-number" data-testid="order-number">
              Order number: {order.number}
            </p>
            {order.giftWrap && (
              <p className="promo-ok" data-testid="gift-wrap-confirmed">
                Gift wrap included
              </p>
            )}
            <p className="order-total">Total paid: {formatMoney(order.totalCents)}</p>
            <button className="primary" onClick={() => setView("catalog")}>
              Continue shopping
            </button>
          </section>
        )}
      </main>

      <footer className="footer">
        <span>Greenlight Store — a deterministic demo target.</span>
        <span>Built so Kane CLI can break it on purpose.</span>
      </footer>
    </div>
  )
}

interface FieldProps {
  id: keyof CheckoutFields
  label: string
  value: string
  error?: string
  type?: string
  onChange: (value: string) => void
}

function Field({ id, label, value, error, type = "text", onChange }: FieldProps) {
  const errorId = `${id}-error`
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        name={id}
        type={type}
        value={value}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        onChange={(event) => onChange(event.target.value)}
      />
      {error && (
        <p className="error" id={errorId} role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
