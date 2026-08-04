# Category Sort - Drag Prototype v2

A static HTML/CSS/JavaScript prototype for GitHub Pages. It recreates the observed Category Sort interaction with draggable portrait cards, yellow category piles, stacked card layers and Free slots.

## Play

- Drag the visible top card from a stack.
- Drop it onto the matching yellow category pile.
- Drop a card onto an empty Free slot when you need to reveal a deeper card.
- Cards in Free slots can also be dragged.
- Tap-to-select and tap-to-place remain available as a fallback.

## Features

- Mouse, pen and touch drag-and-drop using Pointer Events
- Mobile-friendly card dragging; the page does not scroll while a card is held
- Card silhouette based on the supplied gameplay footage
- 10 sample levels
- Move limits, coins, Hint, Undo, Magnet and Restart
- Win/fail results and simulated x2 reward
- Local progress saving
- Playtest JSON export
- Direct level URL, for example: `?level=7`

## Deploy to GitHub Pages

1. Create a public GitHub repository.
2. Upload everything in this folder to the repository root.
3. Open **Settings > Pages**.
4. Under **Build and deployment**, select **Deploy from a branch**.
5. Select the `main` branch and `/root`, then save.

The published URL will normally be:

`https://YOUR-USERNAME.github.io/YOUR-REPOSITORY/`

## Files

- `index.html` - page structure
- `style.css` - board and card visuals
- `game.js` - game, drag and economy logic
- `data/levels.js` - editable level definitions

## Edit levels

Edit `data/levels.js`. Each stack is ordered from bottom card to top card. The last item in a stack is therefore the first visible draggable card.

Level 10 is a prototype extension rather than an exact reconstruction from the source footage.
