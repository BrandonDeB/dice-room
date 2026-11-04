# Rolls, effects and modifiers

A card's `rolls` list gives it buttons. A **roll** throws dice from a
[formula](formulas.md). It can have **effects**: changes to other components when you use
it, like spending an arrow or a spell slot. It also picks up **modifiers**: bonuses like
Bless (+1d4) that are added to its dice while they're switched on.

## Writing rolls

````markdown
```dicelist
type: weapon
name: Longbow
rolls:
  - name: Hit
    dice: 1d20 + {{dex mod}} + {{proficiency}}
    categories: [attack, ranged]
    effects:
      - target: inventory
        action: remove
        args: { item: Arrows }
  - name: Damage
    dice: 1d8 + {{dex mod}}
    categories: [damage]
```
````

Each roll has:

| Field | Required | Description |
| --- | --- | --- |
| `name` | Yes | The row's name, such as Hit, Damage or Stealth. |
| `dice` | No | A [formula](formulas.md), like `1d20 + {{dex mod}}`. Without dice, the button only runs the effects. |
| `categories` | No | What kind of roll it is, such as `attack` or `save`, so modifiers can apply. See [categories](#categories). |
| `modifiers` | No | Modifier names to include, whatever their categories. |
| `effects` | No | What happens when it's used. See [effects](#effects). |
| `description` | No | Shown under the name. |
| `button` | No | The button's text. Defaults to **Roll**, or **Use** without dice. |
| `value` | No | A formula shown with the name, such as an ability score. |
| `rolls` | No | Rolls that belong with this one, like an ability's save. See [rolls inside rolls](#rolls-inside-rolls). |

Each row shows the dice it will throw with modifiers included, which modifiers those are,
and what its effects will do. These update whenever any of the character's notes change.

With `layout: { rolls: grid }` on the card, its rolls show as a grid of buttons, like a skill list, and
a d20 roll shows only its bonus, such as **Stealth +5**. Everything a row would show is
read out with the button and shown as its tooltip.

## Rolls inside rolls

A roll can hold rolls that belong with it, written like any other roll. An ability's check
can hold its save:

```yaml
layout: { rolls: grid }
rolls:
  - name: DEX
    value: "{{dex}}"
    dice: 1d20 + {{dex mod}}
    categories: [check, dexterity]
    rolls:
      - { name: Save, dice: "1d20 + {{dex mod}} + {{proficiency}}", categories: [save, dexterity] }
```

In a grid, this is a tile reading **DEX 17 (+3)**: click the tile, or press Enter on it, for
the check, and its **Save +6** button for the save. Without a grid, the inner rolls are
indented rows under it. Rolls inside rolls can't hold more rolls.

## Buttons without dice

A roll without `dice` is a button that runs its effects, such as casting Goodberry or using
a feature. Give it a `button` to say what it does:

```yaml
type: spell
name: Goodberry
rolls:
  - name: Cast
    button: Cast
    effects:
      - target: inventory
        action: add
        args: { item: Goodberry, quantity: 10, description: Eat one to restore 1 hit point }
      - target: consumables
        action: use
        args: { name: 1st-level spell slots }
```

The Dice view doesn't need to be open. `$total` and `$natural` can't be used, since
nothing is rolled.

## Effects

Each effect has:

| Field | Required | Description |
| --- | --- | --- |
| `target` | Yes | The component to act on, such as `inventory` or `consumables`, or `event` to [fire an event](#firing-events). |
| `action` | Yes | One of that component's actions, such as `remove`. Each component's page lists them. |
| `args` | No | The action's arguments. |
| `if` | No | Only run when this holds. See [conditional effects](#conditional-effects). |

The effect acts on the one card of the character that has that component. For components
holding named entries, like consumables, modifiers and values, the `name` argument picks
the card that holds it.

### Before you click

Each roll shows what its effects will do, such as "Uses 1 of Arrows (2 left)". Each line
links to the card it changes. If an effect would fail, the roll shows why in red instead,
such as "Not enough Arrows: have 0, need 1", and its button is hidden until there's enough.

### What happens when you click

1. If the Dice view isn't open, or you haven't joined a room, nothing happens and a notice
   says why. No effects run.
2. Every effect is checked first. If any would fail, a notice explains why, **nothing is
   spent, and the dice are not thrown**.
3. The effects run in order, and the dice are thrown.
4. A notice announces what the effects did, such as "Used 1 of Arrows. 1 left."
   A natural 20 or a natural 1 on a d20 is announced too.

### Using the roll's total

An effect argument written as `$total` is replaced with what the roll came to. Those
effects run after the dice are thrown. For example, a potion that heals by its roll:

```yaml
rolls:
  - name: Drink
    dice: 2d4 + 2
    effects:
      - target: health
        action: heal
        args: { amount: $total }
```

Before you roll, the effect shows as "Heal by the roll's total".

### Conditional effects

An effect with an `if` only runs when its [condition](formulas.md#conditions) holds. After
a roll, `$total` is what it came to and `$natural` is the d20 that counted. A death saving
throw that counts successes and failures in two [values](components/values.md):

```yaml
rolls:
  - name: Death save
    dice: 1d20
    categories: [save]
    effects:
      - if: $natural == 20
        target: health
        action: heal
        args: { amount: 1 }
      - if: $total >= 10 and $natural < 20
        target: values
        action: increase
        args: { name: Death save successes }
      - if: $natural == 1
        target: values
        action: increase
        args: { name: Death save failures, amount: 2 }
      - if: $total < 10 and $natural > 1
        target: values
        action: increase
        args: { name: Death save failures }
```

Before you roll, these show what they'll do and when, such as
"If $total >= 10 and $natural < 20: Increases Death save successes (now 0)". They don't
stop the roll, even if they couldn't run right now.

An `if` that doesn't use the roll, like `{{exhaustion}} > 0`, is checked before rolling,
and the effect is left out when it doesn't hold.

### Firing events

An effect can fire a character [event](events.md) instead, using `target: event` and
`action: emit` with the event's `name`. Everything subscribed to that event reacts.

```yaml
effects:
  - target: event
    action: emit
    args: { name: long rest }
```

## Advantage, disadvantage and critical hits

**Right-click** a roll, or use the context menu key, for more ways to roll it:

1. On a roll with a d20: **Roll with advantage**, **Roll with disadvantage**, or
   [a modifier for that roll](#a-modifier-for-one-roll). The d20 is rolled twice and the
   higher or lower one counts.
2. On other rolls: **Roll critical hit (double the dice)**, which doubles every die,
   including dice added by modifiers, or a modifier for that roll.

A [modifier](components/modifiers.md) can grant advantage or disadvantage too, with
`advantage` or `disadvantage` as its value, for something that lasts a while, such as
being poisoned. Advantage and disadvantage cancel out: with both, the roll is normal.

### A modifier for one roll

For a bonus or penalty that only matters right now, such as a spell cast on you this turn
or a DM's ruling, right-click the roll and choose **Roll with a modifier...**. In the dialog:

1. Type a number like `-4` or dice like `1d4`. This is optional.
2. On d20 rolls, choose **Normal**, **With advantage** or **With disadvantage**.
   On other rolls, switch on **Critical hit** to double the dice.
3. Press Enter or Roll.

It applies to that roll only, on top of any other modifiers, and nothing is saved.

## Modifiers

A roll includes a [modifier](components/modifiers.md) while the modifier is switched on and
either:

1. the roll names it in its `modifiers` list, or
2. the roll and the modifier share a **category**.

### Categories

A roll's `categories` describe what kind of roll it is, in your own words. A modifier with
`appliesTo: [attack]` is added to every roll with the `attack` category, without each roll
having to name it. Categories aren't case sensitive.

Pick categories that suit your game and use them the same way across your cards. For D&D,
the [example sheet](example-sheet.md) uses `attack` and `damage` on weapons and spells,
`check` and `save` on ability rolls, and the skill or ability's own name, like `stealth`,
so a modifier with `appliesTo: save` reaches every saving throw and one with
`appliesTo: stealth` reaches only Stealth checks.

[Values](components/values.md) have categories too, so modifiers can add to them, such as
a shield adding 2 to armor class.

### How modifiers are added

All dice come first and numbers are added together at the end. With Bless (1d4) and
Archery (+2) on, `1d20+5` becomes `1d20+1d4+7`. A modifier that comes to nothing, like
exhaustion at level 0, isn't listed.

Rolls show a line such as "Includes: Bless (1d4), Archery (+2)". Modifiers the roll would
use but that are switched off are listed as "Off: Bless (1d4)", unless the modifier has
`showWhenOff: false`. Each name links to where
the modifier is set: click to open it, or hover for a preview where you can switch it on.

### When a roll refuses

A roll won't be thrown, and shows why, if:

1. its dice have a mistake, or use a value the character doesn't have,
2. it names a modifier the character doesn't have,
3. two modifiers it would use share a name, or
4. a modifier it would use has a value with a mistake.

These are checked before effects run, so nothing is spent on a refused roll.
