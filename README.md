# Obsidian Dice Room

This is an Obsidian.md plugin dedicated to rolling dice with friends.
Users may customize their dice, join rooms, and roll with their friends.

## Dependencies

To use required webhooks, a web server must be hosted and configured in the plugin settings.
The source code for the server may be found [Here](https://github.com/BrandonDeB/dungeon-master).
The project also uses a customized version of [dice-box-threejs](https://github.com/3d-dice/dice-box-threejs)
*The modified version fixes some issues and allows for pre-calculated results*

## Manually installing the plugin

- Copy over `main.js`, `styles.css`, `manifest.json` to your vault `VaultFolder/.obsidian/plugins/your-plugin-id/`.
- Configure settings to use the hosted web server and personal settings
