import { ComponentFactory } from "./base-component";
import { ConsumableComponent } from "./consumable-component";
import { HealthComponent } from "./health-component";
import { RestComponent } from "./rest-component";
import { InventoryComponent } from "./inventory";
import { ModifierComponent } from "./modifier-component";
import { SkillsComponent } from "./skills-component";
import { SpellComponent } from "./spell-component";
import { StatsComponent } from "./stats-component";
import { WeaponComponent } from "./weapon-component";

export function registerComponents() {
	ComponentFactory.register(WeaponComponent);
	ComponentFactory.register(SpellComponent);
	ComponentFactory.register(InventoryComponent);
	ComponentFactory.register(SkillsComponent);
	ComponentFactory.register(StatsComponent);
	ComponentFactory.register(ModifierComponent);
	ComponentFactory.register(ConsumableComponent);
	ComponentFactory.register(RestComponent);
	ComponentFactory.register(HealthComponent);
}
