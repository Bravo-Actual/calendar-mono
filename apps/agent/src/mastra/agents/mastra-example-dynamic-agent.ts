// Minimal dynamic agent example for testing
import { Agent } from '@mastra/core/agent';
import { getDefaultModel, MODEL_MAP } from '../models.js';

// Define runtime context type
type Runtime = {
  'model-id': string;
  'jwt-token': string;
  'persona-id': string;
  'persona-name': string;
  'persona-traits': string;
  'persona-instructions': string;
  'persona-temperature': number;
  'persona-top-p': number;
  'memory-resource': string;
  'memory-thread': string;
};

export const mastraExampleDynamicAgent = new Agent<'MastraExampleDynamic', any, any, Runtime>({
  name: 'MastraExampleDynamic',
  instructions: ({ runtimeContext }) => {
    const personaName = runtimeContext.get('persona-name');
    if (personaName) {
      return `You are a dynamic agent with persona: ${personaName}`;
    }
    return 'You are a static agent';
  },
  model: ({ runtimeContext }) => {
    const modelId = runtimeContext.get('model-id');
    if (modelId) {
      const modelFactory = MODEL_MAP[modelId];
      if (modelFactory) {
        return modelFactory();
      }
    }
    return MODEL_MAP[getDefaultModel(true)]();
  },
  tools: {},
});
