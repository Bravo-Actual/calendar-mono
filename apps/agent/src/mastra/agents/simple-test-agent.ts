// Simple test agent with no tools to debug multiple response issue
import { Agent } from '@mastra/core/agent';
import { MODEL_MAP, getDefaultModel } from '../models.js';

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

export const simpleTestAgent = new Agent<'SimpleTest', any, any, Runtime>({
  name: 'SimpleTest',
  instructions: ({ runtimeContext }) => {
    const personaName = runtimeContext.get('persona-name');
    const personaTraits = runtimeContext.get('persona-traits');
    const personaInstructions = runtimeContext.get('persona-instructions');

    const baseInstructions = `You are a helpful AI assistant. Be concise and friendly.`;

    if (personaName || personaTraits || personaInstructions) {
      console.log(`Using persona: ${personaName || 'Simple Test'}`);
      return `${baseInstructions}\n\nPersona: ${personaName || 'Simple Test'}\nTraits: ${personaTraits || 'None'}\nInstructions: ${personaInstructions || 'None'}`;
    } else {
      console.log('No persona data found, using fallback instructions');
      return baseInstructions;
    }
  },
  model: ({ runtimeContext }) => {
    const modelId = runtimeContext.get('model-id') || getDefaultModel(true);
    console.log(`Using model: ${modelId}`);

    const modelFactory = MODEL_MAP[modelId];
    if (!modelFactory) {
      console.warn(`Model ${modelId} not found, falling back to default`);
      return MODEL_MAP[getDefaultModel(true)]();
    }

    const temperature = runtimeContext.get('persona-temperature');
    const topP = runtimeContext.get('persona-top-p');

    const model = modelFactory();
    if (model && typeof model.withConfig === 'function') {
      const config: any = {};

      if (temperature !== undefined && temperature !== null) {
        config.temperature = temperature;
        console.log(`Using persona temperature: ${temperature}`);
      } else if (topP !== undefined && topP !== null) {
        config.top_p = topP;
        console.log(`Using persona top_p: ${topP}`);
      } else {
        config.temperature = 0.7;
        console.log(`Using default temperature: 0.7`);
      }

      return model.withConfig(config);
    }
    return model;
  },
  // No tools - keep it simple
  tools: {},
});