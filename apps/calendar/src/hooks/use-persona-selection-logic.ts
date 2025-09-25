/**
 * Persona Selection Logic Hook
 *
 * Implements the persona selection fallback hierarchy from the spec:
 * 1. Persisted selection from localStorage
 * 2. User default persona (from database)
 * 3. First available persona
 */

import { useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useAIPersonas } from '@/lib/data'
import { usePersonaSelection } from '@/store/chat'

export function usePersonaSelectionLogic() {
  const { user } = useAuth()
  const { data: personas = [], isLoading } = useAIPersonas(user?.id)
  const { selectedPersonaId, setSelectedPersonaId } = usePersonaSelection()

  // Implement persona selection fallback hierarchy
  useEffect(() => {
    // Don't run until personas are loaded and we have a user
    if (isLoading || !user?.id || personas.length === 0) return

    // If we already have a valid persisted selection, use it
    if (selectedPersonaId) {
      const persistedPersonaExists = personas.some(p => p.id === selectedPersonaId)
      if (persistedPersonaExists) {
        return // Keep current selection
      }
    }

    // Apply fallback hierarchy
    let personaToSelect: string | null = null

    // 1. Try user default persona
    const defaultPersona = personas.find(p => p.is_default)
    if (defaultPersona) {
      personaToSelect = defaultPersona.id
    } else {
      // 2. Fallback to first available persona
      if (personas.length > 0) {
        personaToSelect = personas[0].id
      }
    }

    // Set the selected persona if we found one
    if (personaToSelect && personaToSelect !== selectedPersonaId) {
      setSelectedPersonaId(personaToSelect)
    }
  }, [personas, isLoading, user?.id, selectedPersonaId, setSelectedPersonaId])

  return {
    selectedPersonaId,
    personas,
    isLoading
  }
}