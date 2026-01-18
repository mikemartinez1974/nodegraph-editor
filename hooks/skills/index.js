import { structuralSkills } from './structural.js';
import { layoutSkills } from './layout.js';
import { validationSkills } from './validation.js';
import { transformationSkills } from './transformation.js';
import { automationSkills } from './automation.js';

/**
 * Attach skill registry helpers onto a GraphCRUD instance.
 * The returned helpers expose registry access without forcing consumers
 * to know about module internals.
 *
 * @param {Object} options
 * @param {Object} options.graphAPI - GraphCRUD instance (or compatible API surface)
 * @param {Object} [options.context] - Additional context passed to every skill
 * @returns {{ executeSkill: Function, listSkills: Function, describeSkill: Function }}
 */
export function attachSkills({ graphAPI, context = {} } = {}) {
  if (!graphAPI) {
    throw new Error('attachSkills requires a graphAPI instance');
  }

  // Re-use existing registry if already attached so multiple calls are idempotent.
  if (graphAPI.__skillRegistry) {
    return graphAPI.__skillRegistry;
  }

  const registry = new Map();

  const registerSkill = (skill) => {
    if (!skill || typeof skill.id !== 'string' || skill.id.length === 0) {
      throw new Error('Skill definitions must include a non-empty id');
    }
    if (registry.has(skill.id)) {
      throw new Error(`Skill "${skill.id}" registered more than once`);
    }
    if (typeof skill.run !== 'function') {
      throw new Error(`Skill "${skill.id}" is missing a run() handler`);
    }
    registry.set(skill.id, {
      id: skill.id,
      title: skill.title || skill.id,
      description: skill.description || '',
      run: skill.run,
      category: skill.category || 'general',
      supportsDryRun: skill.supportsDryRun !== false,
      contracts: skill.contracts || {}
    });
  };

  [
    ...structuralSkills,
    ...layoutSkills,
    ...validationSkills,
    ...transformationSkills,
    ...automationSkills
  ].forEach(registerSkill);

  const listSkills = () => {
    return Array.from(registry.values()).map((skill) => ({
      id: skill.id,
      title: skill.title,
      description: skill.description,
      category: skill.category,
      supportsDryRun: skill.supportsDryRun,
      contracts: skill.contracts
    }));
  };

  const describeSkill = (id) => {
    const skill = registry.get(id);
    if (!skill) return null;
    return {
      id: skill.id,
      title: skill.title,
      description: skill.description,
      category: skill.category,
      supportsDryRun: skill.supportsDryRun,
      contracts: skill.contracts
    };
  };

  const executeSkill = async (id, params = {}) => {
    const skill = registry.get(id);
    if (!skill) {
      return { success: false, error: `Unknown skill "${id}"` };
    }

    if (params?.dryRun && skill.supportsDryRun === false) {
      return { success: false, error: `Skill "${id}" does not support dry runs` };
    }

    const skillContext = {
      graphAPI,
      now: new Date(),
      ...context
    };

    try {
      const result = await skill.run(skillContext, params || {});
      return result && typeof result === 'object'
        ? result
        : { success: Boolean(result) };
    } catch (error) {
      console.error(`[Skills] "${id}" failed:`, error);
      return {
        success: false,
        error: error?.message || `Skill "${id}" failed`
      };
    }
  };

  const registryApi = {
    executeSkill,
    listSkills,
    describeSkill
  };

  graphAPI.executeSkill = executeSkill;
  graphAPI.listSkills = listSkills;
  graphAPI.describeSkill = describeSkill;
  graphAPI.__skillRegistry = registryApi;

  return registryApi;
}
