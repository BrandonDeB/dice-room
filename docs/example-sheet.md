# Example sheet: a D&D 5e ranger

A whole character built from cards, to copy and change. Nothing here is built into the
plugin: the ability modifiers, proficiency bonus, armor class, skills, hit dice and death
saves are all written as [values](components/values.md), [rolls](rolls.md) and other
components, so you can change any rule or use another game's.

Put every card in notes with the same `character` property, such as `character: Aria`.

## Character

Level, proficiency, armor class and initiative. A long rest restores hit points, takes away
a level of exhaustion and clears death saves.

````markdown
```dicelist
type: character
name: Aria
picture: aria.png
fields:
  Class: Ranger
  Speed: 30 ft
values:
  - { name: level, value: 5 }
  - { name: proficiency, value: "2 + floor(({{level}} - 1) / 4)" }
  - { name: Armor class, value: "12 + {{dex mod}}", categories: [armor class] }
  - { name: Passive Perception, value: "10 + {{perception}}" }
rolls:
  - { name: Initiative, dice: "1d20 + {{dex mod}}", categories: [initiative, check] }
health:
  max: 44
  current: 44
on:
  - { event: long rest, target: health, action: restore }
```
````

## Ability scores

Each score, its modifier, a check and a save. Rangers are proficient in Strength and
Dexterity saves. `layout: grid` shows them as tiles.

````markdown
```dicelist
name: Ability scores
layout: grid
values:
  - { name: str, value: 12 }
  - { name: dex, value: 17 }
  - { name: con, value: 14 }
  - { name: int, value: 10 }
  - { name: wis, value: 15 }
  - { name: cha, value: 8 }
  - { name: str mod, value: "({{str}} - 10) / 2" }
  - { name: dex mod, value: "({{dex}} - 10) / 2" }
  - { name: con mod, value: "({{con}} - 10) / 2" }
  - { name: int mod, value: "({{int}} - 10) / 2" }
  - { name: wis mod, value: "({{wis}} - 10) / 2" }
  - { name: cha mod, value: "({{cha}} - 10) / 2" }
rolls:
  - { name: STR check, dice: "1d20 + {{str mod}}", categories: [check, strength] }
  - { name: DEX check, dice: "1d20 + {{dex mod}}", categories: [check, dexterity] }
  - { name: CON check, dice: "1d20 + {{con mod}}", categories: [check, constitution] }
  - { name: INT check, dice: "1d20 + {{int mod}}", categories: [check, intelligence] }
  - { name: WIS check, dice: "1d20 + {{wis mod}}", categories: [check, wisdom] }
  - { name: CHA check, dice: "1d20 + {{cha mod}}", categories: [check, charisma] }
  - { name: STR save, dice: "1d20 + {{str mod}} + {{proficiency}}", categories: [save, strength] }
  - { name: DEX save, dice: "1d20 + {{dex mod}} + {{proficiency}}", categories: [save, dexterity] }
  - { name: CON save, dice: "1d20 + {{con mod}}", categories: [save, constitution] }
  - { name: INT save, dice: "1d20 + {{int mod}}", categories: [save, intelligence] }
  - { name: WIS save, dice: "1d20 + {{wis mod}}", categories: [save, wisdom] }
  - { name: CHA save, dice: "1d20 + {{cha mod}}", categories: [save, charisma] }
```
````

Dividing rounds down, so `({{dex}} - 10) / 2` is the ability modifier.

## Skills

A roll per skill: the ability modifier, plus proficiency where proficient. For expertise,
add `2 * {{proficiency}}` instead. Perception is also a value, so Passive Perception can use it.

````markdown
```dicelist
name: Skills
layout: grid
values:
  - { name: perception, value: "{{wis mod}} + {{proficiency}}" }
rolls:
  - { name: Acrobatics, dice: "1d20 + {{dex mod}}", categories: [check, skill, acrobatics] }
  - { name: Animal Handling, dice: "1d20 + {{wis mod}}", categories: [check, skill, animal handling] }
  - { name: Arcana, dice: "1d20 + {{int mod}}", categories: [check, skill, arcana] }
  - { name: Athletics, dice: "1d20 + {{str mod}}", categories: [check, skill, athletics] }
  - { name: Deception, dice: "1d20 + {{cha mod}}", categories: [check, skill, deception] }
  - { name: History, dice: "1d20 + {{int mod}}", categories: [check, skill, history] }
  - { name: Insight, dice: "1d20 + {{wis mod}}", categories: [check, skill, insight] }
  - { name: Intimidation, dice: "1d20 + {{cha mod}}", categories: [check, skill, intimidation] }
  - { name: Investigation, dice: "1d20 + {{int mod}}", categories: [check, skill, investigation] }
  - { name: Medicine, dice: "1d20 + {{wis mod}}", categories: [check, skill, medicine] }
  - { name: Nature, dice: "1d20 + {{int mod}}", categories: [check, skill, nature] }
  - { name: Perception, dice: "1d20 + {{perception}}", categories: [check, skill, perception] }
  - { name: Performance, dice: "1d20 + {{cha mod}}", categories: [check, skill, performance] }
  - { name: Persuasion, dice: "1d20 + {{cha mod}}", categories: [check, skill, persuasion] }
  - { name: Religion, dice: "1d20 + {{int mod}}", categories: [check, skill, religion] }
  - { name: Sleight of Hand, dice: "1d20 + {{dex mod}}", categories: [check, skill, sleight of hand] }
  - { name: Stealth, dice: "1d20 + {{dex mod}} + {{proficiency}}", categories: [check, skill, stealth] }
  - { name: Survival, dice: "1d20 + {{wis mod}} + {{proficiency}}", categories: [check, skill, survival] }
```
````

## Proficiencies

Languages and the like are [fields](components/fields.md). A tool you roll checks with is a roll.

````markdown
```dicelist
name: Proficiencies
fields:
  Languages: [Common, Elvish]
  Armor: [Light, Medium, Shields]
  Weapons: [Simple, Martial]
rolls:
  - { name: Herbalism kit, dice: "1d20 + {{wis mod}} + {{proficiency}}", categories: [check, tool] }
```
````

## A weapon

Each hit spends an arrow. Archery is a fighting style that adds 2 to ranged attacks.

````markdown
```dicelist
type: weapon
name: Longbow
fields:
  Range: 150/600 ft
rolls:
  - name: Hit
    dice: 1d20 + {{dex mod}} + {{proficiency}}
    categories: [attack, ranged]
    effects:
      - { target: inventory, action: remove, args: { item: Arrows } }
  - name: Damage
    dice: 1d8 + {{dex mod}}
    categories: [damage]
modifiers:
  - { name: Archery, value: 2, appliesTo: [ranged], active: true, description: Fighting style }
```
````

For a finesse weapon, use the better of Strength and Dexterity: `max({{str mod}}, {{dex mod}})`.

## Spells

A spell save DC is a value. Hunter's Mark is a concentration modifier, and casting it
spends a slot. Cure Wounds heals by what it rolls.

````markdown
```dicelist
type: spellcasting
name: Spellcasting
values:
  - { name: spell save DC, value: "8 + {{proficiency}} + {{wis mod}}" }
rolls:
  - { name: Spell attack, dice: "1d20 + {{wis mod}} + {{proficiency}}", categories: [attack, spell] }
consumables:
  - { name: 1st-level spell slots, max: 4, refill: long rest }
  - { name: 2nd-level spell slots, max: 2, refill: long rest }
```
````

````markdown
```dicelist
type: spell
name: Hunter's Mark
description: Bonus action, concentration. Mark a creature to deal an extra 1d6 damage to it.
modifiers:
  - { name: Hunter's Mark, value: 1d6, appliesTo: [damage], concentration: true }
rolls:
  - name: Cast
    button: Cast
    effects:
      - { target: consumables, action: use, args: { name: 1st-level spell slots } }
      - { target: modifiers, action: "on", args: { name: Hunter's Mark } }
```
````

````markdown
```dicelist
type: spell
name: Cure Wounds
rolls:
  - name: Heal
    dice: 2d8 + {{wis mod}}
    effects:
      - { target: consumables, action: use, args: { name: 1st-level spell slots } }
      - { target: health, action: heal, args: { amount: $total } }
```
````

## Hit dice and death saves

Hit dice are a consumable: rolling one spends it and heals by the roll. A long rest gives
back half of them. Death saves count successes and failures in two values, with
[conditional effects](rolls.md#conditional-effects) deciding which.

````markdown
```dicelist
name: Hit dice and death saves
consumables:
  - { name: Hit dice, max: 5, gain: { long rest: 2 }, description: d10 }
values:
  - { name: Death save successes, value: 0, min: 0, max: 3 }
  - { name: Death save failures, value: 0, min: 0, max: 3 }
rolls:
  - name: Hit die
    dice: 1d10 + {{con mod}}
    effects:
      - { target: consumables, action: use, args: { name: Hit dice } }
      - { target: health, action: heal, args: { amount: $total } }
  - name: Death save
    dice: 1d20
    categories: [save]
    effects:
      - { if: "$natural == 20", target: health, action: heal, args: { amount: 1 } }
      - { if: "$total >= 10 and $natural < 20", target: values, action: increase, args: { name: Death save successes } }
      - { if: "$natural == 1", target: values, action: increase, args: { name: Death save failures, amount: 2 } }
      - { if: "$total < 10 and $natural > 1", target: values, action: increase, args: { name: Death save failures } }
on:
  - { event: long rest, target: values, action: set, args: { name: Death save successes, value: 0 } }
  - { event: long rest, target: values, action: set, args: { name: Death save failures, value: 0 } }
```
````

## Conditions and exhaustion

Each condition is a modifier with a switch. Exhaustion is a value you count up and down,
and its modifier takes 2 per level from d20 rolls (the 2024 rules).

````markdown
```dicelist
name: Conditions
values:
  - { name: exhaustion, value: 0, min: 0, max: 6 }
modifiers:
  - { name: Blinded, value: disadvantage, appliesTo: [attack] }
  - { name: Frightened, value: disadvantage, appliesTo: [attack, check] }
  - { name: Invisible, value: advantage, appliesTo: [attack] }
  - { name: Poisoned, value: disadvantage, appliesTo: [attack, check] }
  - { name: Prone, value: disadvantage, appliesTo: [attack] }
  - { name: Restrained, value: disadvantage, appliesTo: [attack] }
  - { name: Exhaustion, value: "-2 * {{exhaustion}}", appliesTo: [attack, check, save], active: true }
on:
  - { event: long rest, target: values, action: decrease, args: { name: exhaustion } }
```
````

## Inventory

The shield adds 2 to armor class while it's equipped.

````markdown
```dicelist
name: Backpack
inventory:
  - { name: Arrows, quantity: 20 }
  - name: Shield
    quantity: 1
    switches: { Equipped: false }
    modifiers:
      - { name: Shield, value: 2, appliesTo: [armor class] }
  - { name: Potion of Healing, quantity: 2 }
```
````

## Rests

````markdown
```dicelist
name: Rest
events: [Short rest, Long rest]
```
````
