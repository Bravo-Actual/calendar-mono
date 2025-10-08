/**
 * Persona Selection Logic Hook
 *
 * Implements the persona selection fallback hierarchy from the spec:
 * 1. Persisted selection from localStorage
 * 2. User default persona (from database)
 * 3. First available persona
 */

import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useAIPersonas } from '@/lib/data-v2';
import { usePersonaSelection } from '@/store/chat';

export function usePersonaSelectionLogic() {
  const { user } = useAuth();
  const personas = useAIPersonas(user?.id) || [];
  const personasLoaded = !!personas || !user?.id;
  const { selectedPersona, selectedPersonaId, setSelectedPersona } = usePersonaSelection();

  // Implement persona selection fallback hierarchy
  useEffect(() => {
    // Don't run until personas are loaded and we have a user
    if (!personasLoaded || !user?.id || personas.length === 0) return;

    // If we already have a valid persisted selection, use it
    if (selectedPersona) {
      const persistedPersonaExists = personas.some((p) => p.id === selectedPersona.id);
      if (persistedPersonaExists) {
        return; // Keep current selection
      }
    }

    // Apply fallback hierarchy - find the persona object to select
    let personaToSelect = null;

    // 1. Try user default persona
    const defaultPersona = personas.find((p) => p.is_default);
    if (defaultPersona) {
      personaToSelect = defaultPersona;
    } else {
      // 2. Fallback to first available persona
      if (personas.length > 0) {
        personaToSelect = personas[0];
      }
    }

    // Set the selected persona if we found one
    if (personaToSelect && personaToSelect.id !== selectedPersonaId) {
      setSelectedPersona(personaToSelect);
    }
  }, [personas, personasLoaded, user?.id, selectedPersona, selectedPersonaId, setSelectedPersona]);

  return {
    selectedPersonaId,
    personas,
    personasLoaded,
  };
}
