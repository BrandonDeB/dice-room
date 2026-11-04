# Test vault

`test-vault/` is a local Obsidian vault for trying out the plugin. It is ignored by git,
so each developer keeps their own.

## How hot reload works

1. `npm run dev` rebuilds `main.js` whenever a source file changes.
2. After each successful build, and whenever `styles.css` or `manifest.json` changes,
   `esbuild.config.mjs` copies those three files into
   `test-vault/.obsidian/plugins/dice-room/`.
3. The [Hot Reload](https://github.com/pjeby/hot-reload) plugin, installed in the vault,
   watches plugin folders that contain a `.hotreload` file and reloads them when they change.
   The build creates that file for you.

The copy step only runs if `test-vault/` exists, so nothing changes for anyone without one.
Production builds never copy.

## Setting it up

1. Create `test-vault/`, and inside it `.obsidian/plugins/hot-reload/`.
2. Download `main.js` and `manifest.json` from the latest
   [Hot Reload release](https://github.com/pjeby/hot-reload/releases) into that folder.
3. Create `test-vault/.obsidian/community-plugins.json` containing `["dice-room", "hot-reload"]`.
4. Run `npm run dev`.
5. In Obsidian, open `test-vault` as a vault. When asked, trust the vault so community plugins can run.

## Sample notes

Keep a note for each component and interaction, so a change can be checked by looking.
Rolls and effects only run with the Dice view open and a room joined,
so a Dice Room server needs to be running.
