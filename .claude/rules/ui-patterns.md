---
paths:
  - "src/components/**/*.tsx"
  - "src/routes/**/*.tsx"
---

# UI component patterns

## Cards

Base card style: `rounded-lg border bg-card p-4`, or `rounded-xl` and `p-5` for
larger cards. An interactive card shows it with `hover:bg-muted/50`, not a ring
or a shadow.

A card that navigates is a `Link` with an arrow that appears on hover, through
the `group` class:

```tsx
<Link
  to="/some-page"
  className="group rounded-xl border bg-card p-5 transition-colors hover:bg-muted/50"
>
  {/* Card content */}
  <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
</Link>
```

A card that opens a dialog is a `button` with no arrow. The arrow means
"another page":

```tsx
<button
  type="button"
  onClick={handleClick}
  className="w-full cursor-pointer text-left rounded-lg transition-colors hover:bg-muted/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
>
  {/* Card content */}
</button>
```

A static or disabled card:

```tsx
<div className="rounded-xl border bg-card p-5 opacity-50">
  {/* Card content */}
</div>
```

## Anything clickable

Every element that responds to a click has `cursor-pointer`: native `<button>`
elements, icons with `onClick`, custom toggles, legend items and tab controls.
The shadcn `<Button>` and `<Link>` already have it.

```tsx
<button
  onClick={handleClick}
  className="cursor-pointer rounded px-2 py-1 hover:bg-muted"
>
  Click me
</button>

<X
  className="h-4 w-4 cursor-pointer opacity-50 hover:opacity-100"
  onClick={handleClose}
/>
```

## Data tables

- A cell that does something on click has a tooltip saying what.
- Prefer icon-only action buttons, with a tooltip as the label.
