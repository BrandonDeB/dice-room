# Getting started

## Requirements

Rooms need a Dice Room server. The server source code is at
[BrandonDeB/dungeon-master](https://github.com/BrandonDeB/dungeon-master).
Someone in your group hosts it, and everyone points their plugin at the same address.

You can roll dice and use character sheets on your own without joining a room,
but you still need the Dice view open.

## Install the plugin

### With BRAT (recommended)

1. Install the [BRAT](https://tfthacker.com/BRAT) community plugin.
2. In BRAT, choose **Add beta plugin** and enter `BrandonDeB/dice-room`.
3. Enable **Dice Room** under **Settings → Community plugins**.

BRAT keeps the plugin up to date for you.

### Manually

1. Download `main.js`, `styles.css`, and `manifest.json` from the latest release.
2. Copy them into `<your vault>/.obsidian/plugins/dice-room/`.
3. Reload Obsidian and enable **Dice Room** under **Settings → Community plugins**.

## Configure

Open **Settings → Dice Room**.

| Setting | What it does | Default |
| --- | --- | --- |
| Backend Server Address | WebSocket address of the Dice Room server, for example `wss://dice.example.com`. | `ws://localhost:8765` |
| Display Name | The name other room members see above your dice. | `Anonymous` |
| Dice Background Color | Main color of your dice. | Black |
| Dice Foreground Color | Color of the numbers on your dice. | White |
| Dice Texture | Texture for your dice. Start typing to search. | None |
| Dice Material | Surface material, such as metal or wood. | None |

The **Dice Preview** at the bottom of the settings rolls a sample die so you can see your choices.

## Join a room

1. Click the **dice** icon in the left ribbon to open the Dice view.
2. Enter a room name and click **Join**. Anyone who joins the same room name rolls with you.
3. Type dice notation, such as `2d6+3`, and press **Roll** or Enter.
4. Click **Leave Room** when you are done.

Clicking a roll on a card also rolls in the Dice view. If the view is not open,
you will see the notice "Open the Dice View first!"

## Next

Set up a [character sheet](character-sheets.md).
