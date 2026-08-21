# Lunch Planner

A mobile-first web app for planning a toddler's 4-compartment school lunch box
(carb / protein / veg / treat), built around three pack modes per day - no
pack, ice pack, or thermos - since most cooked foods aren't safe to pack
without one after sitting unrefrigerated for 3-4 hours.

Live at: https://jawntron.github.io/kidslunchplanner/

## Features

- Generates a Mon-Fri week with no repeated carb or protein variety
- Per-day pack mode (No pack / Ice pack / Thermos) with per-cell re-roll and locking
- Sunday batch-prep checklist and an aisle-grouped shopping list, both derived from the week
- Editable, nut-free food bank - add your own foods, mark likes/dislikes

## Development

```bash
npm install
npm run dev      # start the dev server
npm test         # run the generator test suite
npm run build    # production build to dist/
```
