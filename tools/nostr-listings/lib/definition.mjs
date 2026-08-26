import { readFileSync } from 'node:fs';
import YAML from 'yaml';
import { validateDefinition } from './listing.mjs';

/**
 * Load and validate a YAML listing definition file.
 * Throws with a readable message listing every problem found.
 */
export function loadDefinition(filePath) {
  let raw;
  try {
    raw = readFileSync(filePath, 'utf8');
  } catch (err) {
    throw new Error(`cannot read ${filePath}: ${err.message}`);
  }
  let def;
  try {
    def = YAML.parse(raw);
  } catch (err) {
    throw new Error(`${filePath} is not valid YAML: ${err.message}`);
  }
  const errors = validateDefinition(def);
  if (errors.length > 0) {
    throw new Error(`${filePath} has problems:\n  - ${errors.join('\n  - ')}`);
  }
  return def;
}
