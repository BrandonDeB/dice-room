# Dice Room

Dice Room is an Obsidian plugin for rolling 3D dice with friends and building
interactive character sheets inside your notes.

- **Roll together.** Join a shared room and everyone sees each other's dice land in real time.
- **Customize your dice.** Pick colors, textures, and materials.
- **Clickable character sheets.** Write small `dicelist` blocks in your notes for stats,
  skills, attacks, spells, and inventory. Click them to roll.
- **Rolls have effects.** Rolling a longbow attack can spend an arrow from your inventory.

## Guides

1. [Getting started](getting-started.md): install the plugin, connect to a server, and join a room.
2. [Character sheets](character-sheets.md): how `dicelist` blocks work and how notes are linked to a character.
3. [Rolls, effects and modifiers](rolls.md): writing rolls, having them spend ammo or change other
   components, and adding bonuses like Bless.

## Component reference

- [Stats](components/stats.md): ability scores and saving throws.
- [Skills](components/skills.md): skill checks using your stat modifiers.
- [Attacks: weapons and spells](components/attacks.md): to-hit and damage rolls, plus effects.
- [Inventory](components/inventory.md): items and quantities that other components can change.
- [Modifier](components/modifier.md): a named bonus with an on/off switch that rolls can include.
- [Consumables](components/consumable.md): spell slots and other limited uses that refill.

## For developers

- [Components and actions](developers/components-and-actions.md): how to build a new
  component and let components talk to each other.
- [Test vault](developers/test-vault.md): a local vault with hot reload for trying out changes.
