import { ComponentFactory } from "./base-component";
import { CharacterComponent } from "./character-component";
import { ConditionsComponent } from "./conditions-component";
import { ConsumableComponent } from "./consumable-component";
import { FeatureComponent } from "./feature-component";
import { HealthComponent } from "./health-component";
import { RestComponent } from "./rest-component";
import { InventoryComponent } from "./inventory";
import { ModifierComponent } from "./modifier-component";
import { ProficienciesComponent } from "./proficiencies-component";
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
	ComponentFactory.register(CharacterComponent);
	ComponentFactory.register(ConditionsComponent);
	ComponentFactory.register(ProficienciesComponent);
	ComponentFactory.register(FeatureComponent);
}
