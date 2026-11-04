# Dice Room

Dice Room is an Obsidian plugin for rolling 3D dice with friends and building
interactive character sheets inside your notes.

- **Roll together.** Join a shared room and everyone sees each other's dice land in real time.
- **Customize your dice.** Pick colors, textures, and materials.
- **Clickable character sheets.** Write small `dicelist` cards in your notes, with rolls,
  values, modifiers and an inventory. Click them to roll. Nothing about one game is built
  in, so they work for any system.
- **Rolls have effects.** Rolling a longbow attack can spend an arrow from your inventory.

## Guides

1. [Getting started](getting-started.md): install the plugin, connect to a server, and join a room.
2. [Character sheets](character-sheets.md): cards, their components, and how notes are linked to a character.
3. [Values and formulas](formulas.md): dice and numbers that use the character's values, like `1d20 + {{dex mod}}`.
4. [Rolls, effects and modifiers](rolls.md): writing rolls, having them spend ammo or change other
   components, and adding bonuses like Bless.
5. [Events](events.md): rests and other moments, and how cards subscribe to them.
6. [Example sheet](example-sheet.md): a whole D&D 5e character to copy.

## Component reference

- [Fields](components/fields.md): labelled details, like class, speed or range.
- [Values](components/values.md): named numbers formulas use, like level or armor class, and counters.
- [Rolls](rolls.md): buttons that roll dice and run effects.
- [Modifiers](components/modifiers.md): named bonuses with switches, including conditions.
- [Consumables](components/consumables.md): spell slots and other limited uses that refill.
- [Inventory](components/inventory.md): items and quantities, with switches like Equipped.
- [Health](components/health.md): hit points and temporary hit points.
- [Events](components/events.md): buttons for rests and other events.

## For developers

- [Components and actions](developers/components-and-actions.md): how cards are built
  from components, and how components talk to each other.
- [Test vault](developers/test-vault.md): a local vault with hot reload for trying out changes.
