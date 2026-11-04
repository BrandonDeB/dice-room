import { registerComponent } from '../component';
import { consumablesComponent } from './consumables';
import { eventsComponent } from './events';
import { fieldsComponent } from './fields';
import { healthComponent } from './health';
import { inventoryComponent } from './inventory';
import { modifiersComponent } from './modifiers';
import { rollsComponent } from './rolls';
import { valuesComponent } from './values';

/** Every component a card can have, by its YAML key. */
export function registerComponents() {
	registerComponent(fieldsComponent);
	registerComponent(valuesComponent);
	registerComponent(rollsComponent);
	registerComponent(modifiersComponent);
	registerComponent(consumablesComponent);
	registerComponent(inventoryComponent);
	registerComponent(healthComponent);
	registerComponent(eventsComponent);
}
