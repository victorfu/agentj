# Chlorophyll Carbon Design System

### 1. Overview & Creative North Star
**Creative North Star: "Synthetic Photosynthesis"**
Chlorophyll Carbon is a high-density, technical design system that bridges the gap between biological organicism and industrial precision. It rejects the generic "SaaS Blue" in favor of a deep, obsidian-green ecosystem where data flows like nutrients through a leaf. The aesthetic is defined by high-contrast primary accents against a low-light, monolithic background, utilizing a technical, utility-first layout that prioritizes speed and clarity.

### 2. Colors
The palette is rooted in `#0f2317` (Obsidian Green), creating a deep, immersive environment where the primary neon green (`#06c656`) acts as a high-frequency signal.

- **The "No-Line" Rule:** Visual separation is achieved through a 10% opacity primary tint (`primary/10`) or subtle background shifts. Avoid solid borders between content blocks; use the `surface_container` tiers to nest data logically without creating visual noise.
- **Surface Hierarchy & Nesting:** Use `surface_container_low` for the main canvas, `surface_container` for primary cards, and `surface_container_high` for interactive hover states or elevated modals.
- **Signature Textures:** Employ a subtle `primary/5` glow (inner shadows) on main containers to simulate biological luminescence.

### 3. Typography
The system uses **Inter** across all levels to maintain a rigorous, engineering-focused clarity. The scale is intentional, moving from tight, technical labels to expansive, heavy displays.

**Typography Scale:**
- **Display/Headline:** 1.875rem (30px) - Extrabold. Used for primary "Project Overview" context.
- **Title/Large:** 1.5rem (24px) - Bold.
- **Section Headers:** 1.125rem (18px) - Bold.
- **Body/Base:** 0.875rem (14px) - Medium. Standard for table data and descriptions.
- **Micro/Utility:** 0.75rem (12px) or 10px - Bold/Uppercase. Used for labels like "TOTAL REQUESTS" or system status.

The typographic rhythm relies on tracking; headlines use `tracking-tight` (-0.025em) to feel architectural, while small labels use `tracking-wider` (0.05em) for legibility at small sizes.

### 4. Elevation & Depth
Depth is not communicated through height, but through **Tonal Layering** and light emission.

- **The Layering Principle:** Stacking is handled by increasing the opacity of the primary tint on the background. A base card is `primary/5`, while a hovered card is `primary/10`.
- **Ambient Shadows:** The system uses the `shadow-lg` preset, but refined: a soft, wide-spread shadow with a primary-tinted glow (`0 10px 15px -3px rgba(6, 198, 86, 0.2)`).
- **Glassmorphism:** Navigation headers use a backdrop-blur (12px) with a semi-transparent `surface` color to maintain context while scrolling.

### 5. Components
- **Buttons:** Primary buttons are high-impact (`#06c656`) with dark text (`#0f2317`). Secondary actions use a "Ghost" style: `primary/10` background with `primary` text.
- **Status Chips:** Pill-shaped with a 20% opacity background of the status color (e.g., `primary/20` for "Running"). Must include an "Active Pulse" animation for live states.
- **Data Tables:** Removed traditional cell borders. Use a `divide-primary/10` rule for rows and a subtle `bg-primary/5` for header backgrounds.
- **Inputs:** Dark-filled (`primary/10`) with no border. On focus, a 2px `primary` ring is applied.

### 6. Do's and Don'ts
- **Do:** Use primary-tinted backgrounds for all structural containers.
- **Do:** Leverage the "Pulse" animation for real-time data indicators.
- **Don't:** Use pure black (#000) or pure white (#FFF) for backgrounds or text. Always use the Chlorophyll-tinted variants.
- **Don't:** Use 1px solid white or gray borders; they break the "Synthetic Photosynthesis" immersion. Use `outline_variant` (primary at 20% opacity) instead.