export type YamlPath = (string | number)[];

/** One edit to a block's YAML, with a path into it. */
export type YamlStep =
	| { op: 'set'; path: YamlPath; value: unknown }
	| { op: 'delete'; path: YamlPath }
	| { op: 'add'; path: YamlPath; value: unknown };
