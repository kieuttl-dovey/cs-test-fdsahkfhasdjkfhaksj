# Category Sort - Text-Only Prototype

A static, text-only gameplay prototype designed for GitHub Pages. It is intended for early level-design, balance and economy testing before building production art or a Unity client.

## Included

- 10 playable levels
- Stack-based card reveal system
- Category matching
- Temporary holding slots
- Move limits and hard levels
- Undo, Hint and Magnet boosters
- Coin rewards and booster costs
- Simulated rewarded-ad x2 reward
- Local progress saving with `localStorage`
- Playtest metrics and JSON export
- Responsive desktop/mobile layout

## Source basis

Levels 1-9 are structured from observations in the supplied Category Sort walkthrough videos. Exact hidden production rules, original level data and randomization logic were not available, so this repository is a functional reverse-engineered prototype rather than a one-to-one recreation. Level 10 is an inferred prototype extension.

## Deploy to GitHub Pages

1. Create a new GitHub repository.
2. Upload all files and folders from this package to the repository root.
3. Open **Settings → Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch**.
5. Select the `main` branch and `/ (root)` folder.
6. Save. GitHub will provide a public URL after deployment.

The project has no external libraries and requires no build command.

## Local testing

You can open `index.html` directly in a browser. For a closer GitHub Pages environment, run a simple local server:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000`.

## Edit levels

All level definitions are stored in:

```text
data/levels.js
```

Each level supports:

```js
{
  id: 1,
  title: "First Sort",
  difficulty: "Normal",
  moveLimit: 50,
  reward: 30,
  tempSlots: 2,
  freeHints: 1,
  freeUndos: 1,
  magnetUses: 0,
  categories: {
    Music: ["Singer", "Guitar", "Piano"]
  },
  stacks: [
    ["Guitar", "Singer"]
  ]
}
```

Within each stack, the last item is the top visible card.

## Current gameplay rule

- Only the top card of each stack is selectable.
- A selected card can be placed into its matching category.
- A selected card can also be placed into an empty temporary slot.
- Moving from a stack or temporary slot counts as one move.
- The player wins when every card is sorted.
- The player loses after reaching the move limit.

## Economy defaults

- Starting coins: 600
- Normal-level reward: 30
- Hard-level reward: 60
- Undo: 200 coins after free uses
- Hint: 300 coins after free uses
- Magnet: limited free inventory
- x2 reward: simulated only; no real ad SDK is included

## Playtest export

Use **Export Session** on the home screen. The game downloads a JSON file containing:

- Level result
- Moves and move limit
- Completion time
- Hint, Undo and Magnet usage
- Temporary-slot usage
- Invalid moves
- Coins spent
- Efficiency score

## GitHub Pages limitations

This static version does not include:

- Real ads or in-app purchases
- User accounts
- Cloud save
- Global analytics database
- Remote configuration
- Multiplayer or leaderboard services

Those features require an external backend or service such as Firebase or Supabase.
