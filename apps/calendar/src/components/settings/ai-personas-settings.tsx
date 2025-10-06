'use client';

import { Box, Brain, ChevronRight, Loader2, Plus, Trash2, Zap } from 'lucide-react';
import * as React from 'react';
import { useState } from 'react';
import { toast } from 'sonner';
import * as z from 'zod';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { useAIAgents } from '@/hooks/use-ai-agents';
import { getAvatarUrl } from '@/lib/avatar-utils';
import {
  type ClientPersona,
  createAIPersona,
  deleteAIPersona,
  deleteAIPersonaAvatar,
  updateAIPersona,
  uploadAIPersonaAvatar,
  useAIPersonas,
} from '@/lib/data-v2';
import { AvatarManager } from '../avatar-manager/avatar-manager';
import { ModelSelector } from './model-selector';

const personaSchema = z
  .object({
    name: z
      .string()
      .min(1, 'Persona name is required')
      .max(100, 'Name must be less than 100 characters'),
    traits: z.string().max(2500, 'Traits must be less than 2500 characters').optional(),
    instructions: z.string().max(5000, 'Instructions must be less than 5000 characters').optional(),
    greeting: z.string().max(500, 'Greeting must be less than 500 characters').optional(),
    agent_id: z.string().min(1, 'Agent is required'),
    model_id: z.string().optional(),
    temperature: z.number().min(0).max(2).nullable().optional(),
    top_p: z.number().min(0).max(1).nullable().optional(),
    is_default: z.boolean().optional(),
    avatar_url: z.string().nullable().optional(),
  })
  .refine(
    (data) => {
      const hasTemp = data.temperature !== null && data.temperature !== undefined;
      const hasTopP = data.top_p !== null && data.top_p !== undefined;
      return hasTemp !== hasTopP;
    },
    {
      message: 'Either temperature OR top_p should be set, but not both',
      path: ['temperature'],
    }
  );

type PersonaFormValues = z.infer<typeof personaSchema>;

interface AIPersonasSettingsProps {
  editingPersona: ClientPersona | null;
  onEditPersona: (persona: ClientPersona | null) => void;
  onSaveHandler?: (saveFunction: (() => void) | null) => void;
  onCancelHandler?: (cancelFunction: (() => void) | null) => void;
  onHasChanges?: (hasChanges: boolean) => void;
}

export function AIPersonasSettings({
  editingPersona,
  onEditPersona,
  onSaveHandler,
  onCancelHandler,
  onHasChanges,
}: AIPersonasSettingsProps) {
  const { user } = useAuth();
  const aiPersonas = useAIPersonas(user?.id) || [];
  const isLoading = !aiPersonas && !!user?.id;
  const { data: agents = [], isLoading: agentsLoading } = useAIAgents();

  const [personaFormData, setPersonaFormData] = useState<PersonaFormValues>({
    name: '',
    traits: '',
    instructions: '',
    greeting: '',
    agent_id: '',
    model_id: '',
    temperature: 0.7,
    top_p: null,
    is_default: false,
  });
  const [personaFormErrors, setPersonaFormErrors] = useState<Record<string, string>>({});
  const [personaAvatarPreview, setPersonaAvatarPreview] = useState<string | null>(null);
  const [savingPersona, setSavingPersona] = useState(false);
  const [isDeletingPersonaAvatar, setIsDeletingPersonaAvatar] = useState(false);

  const startEditingPersona = (persona: ClientPersona) => {
    onEditPersona(persona);
    setPersonaFormData({
      name: persona.name,
      traits: persona.traits || '',
      instructions: persona.instructions || '',
      greeting: persona.greeting || '',
      agent_id: persona.agent_id || '',
      model_id: persona.model_id || '',
      temperature: persona.temperature || 0.7,
      top_p: persona.top_p || null,
      is_default: persona.is_default || false,
    });
    setPersonaFormErrors({});
    setPersonaAvatarPreview(null);
  };

  const cancelEditingPersona = () => {
    onEditPersona(null);
    setPersonaFormData({
      name: '',
      traits: '',
      instructions: '',
      greeting: '',
      agent_id: '',
      model_id: '',
      temperature: 0.7,
      top_p: null,
      is_default: false,
    });
    setPersonaFormErrors({});
    setPersonaAvatarPreview(null);
  };

  const handlePersonaInputChange = (
    field: keyof PersonaFormValues,
    value: string | number | boolean
  ) => {
    setPersonaFormData((prev) => ({ ...prev, [field]: value }));
    if (personaFormErrors[field]) {
      setPersonaFormErrors((prev) => ({ ...prev, [field]: '' }));
    }
    onHasChanges?.(true);
  };

  const handlePersonaAvatarChange = async (imageBlob: Blob) => {
    if (!user?.id) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      setPersonaAvatarPreview(e.target?.result as string);
    };
    reader.readAsDataURL(imageBlob);

    if (!editingPersona?.id || editingPersona.id === 'new') {
      setPersonaAvatarPreview(null);
      toast.error('Please create and save the persona first before adding an avatar');
      return;
    }

    try {
      const avatarUrl = await uploadAIPersonaAvatar(user.id, editingPersona.id, imageBlob);
      setPersonaFormData((prev) => ({ ...prev, avatar_url: avatarUrl }));
      toast.success('Avatar updated successfully');
    } catch (error) {
      console.error('Error uploading avatar:', error);
      toast.error('Failed to upload avatar');
      setPersonaAvatarPreview(null);
    }
  };

  const validatePersonaForm = () => {
    try {
      personaSchema.parse(personaFormData);
      setPersonaFormErrors({});
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const newErrors: Record<string, string> = {};
        error.issues.forEach((err) => {
          if (err.path[0]) {
            newErrors[err.path[0] as string] = err.message;
          }
        });
        setPersonaFormErrors(newErrors);
      }
      return false;
    }
  };

  const savePersona = async () => {
    if (!validatePersonaForm() || !editingPersona) {
      return;
    }

    setSavingPersona(true);
    const isNewPersona = editingPersona.id === 'new';
    const personaData = { ...personaFormData };

    try {
      if (!user?.id) return;

      if (isNewPersona) {
        await createAIPersona(user.id, personaData);
      } else {
        await updateAIPersona(user.id, editingPersona.id, personaData);
      }

      cancelEditingPersona();
      setSavingPersona(false);
      onHasChanges?.(false);
      toast.success(
        isNewPersona ? 'AI persona created successfully' : 'AI persona updated successfully'
      );
    } catch (error) {
      console.error('Failed to save persona:', error);
      setSavingPersona(false);
      toast.error('Failed to save persona');
    }
  };

  // Expose save and cancel handlers to parent
  React.useEffect(() => {
    if (editingPersona) {
      onSaveHandler?.(savePersona);
      onCancelHandler?.(cancelEditingPersona);
    } else {
      onSaveHandler?.(null);
      onCancelHandler?.(null);
    }
    return () => {
      onSaveHandler?.(null);
      onCancelHandler?.(null);
    };
  }, [editingPersona, cancelEditingPersona, onCancelHandler, onSaveHandler, savePersona]); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePersonaAvatarDelete = async () => {
    if (!user?.id || !editingPersona?.id || editingPersona.id === 'new') return;

    try {
      setIsDeletingPersonaAvatar(true);
      setPersonaAvatarPreview(null);

      await deleteAIPersonaAvatar(user.id, editingPersona.id, editingPersona.avatar_url);

      setPersonaFormData((prev) => ({ ...prev, avatar_url: null }));
      toast.success('Avatar deleted successfully');
    } catch (error) {
      console.error('Error deleting avatar:', error);
      toast.error('Failed to delete avatar');
    } finally {
      setIsDeletingPersonaAvatar(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // Show edit form if editing a persona
  if (editingPersona) {
    const livePersona = aiPersonas.find((a) => a.id === editingPersona.id) || editingPersona;
    const currentAvatar = isDeletingPersonaAvatar
      ? null
      : personaAvatarPreview || livePersona.avatar_url || null;
    const initials = editingPersona.name
      .split(' ')
      .map((n: string) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);

    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <h3 className="text-lg font-medium">Edit Assistant</h3>
          <p className="text-sm text-muted-foreground">
            Customize your AI assistant&apos;s personality and behavior.
          </p>
        </div>

        {personaFormErrors.general && (
          <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-4">
            <p className="text-sm text-destructive">{personaFormErrors.general}</p>
          </div>
        )}

        <div className="flex gap-6 items-start">
          <div className="flex flex-col items-center">
            <AvatarManager
              src={currentAvatar}
              fallback={<span className="text-lg">{initials}</span>}
              size={96}
              variant="circle"
              disabled={!editingPersona?.id || editingPersona.id === 'new'}
              disabledMessage="Please create and save the persona first before adding an avatar"
              isUploading={savingPersona}
              onImageChange={handlePersonaAvatarChange}
              onImageDelete={handlePersonaAvatarDelete}
              maxSizeMB={5}
              acceptedTypes={['image/jpeg', 'image/png', 'image/webp']}
              alt={personaFormData.name}
            />
          </div>

          <div className="flex-1 space-y-6">
            <div className="space-y-2">
              <Label>Assistant Name *</Label>
              <Input
                placeholder="e.g., Maya the Calendar Expert"
                value={personaFormData.name}
                onChange={(e) => handlePersonaInputChange('name', e.target.value)}
              />
              {personaFormErrors.name && (
                <p className="text-sm text-destructive">{personaFormErrors.name}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>AI Agent *</Label>
              <Select
                value={personaFormData.agent_id}
                onValueChange={(value) => handlePersonaInputChange('agent_id', value)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select an AI agent..." />
                </SelectTrigger>
                <SelectContent>
                  {agentsLoading ? (
                    <SelectItem value="__loading__" disabled>
                      Loading agents...
                    </SelectItem>
                  ) : agents.length === 0 ? (
                    <SelectItem value="__no_agents__" disabled>
                      No agents available
                    </SelectItem>
                  ) : (
                    agents.map((agent) => (
                      <SelectItem key={agent.id} value={agent.id}>
                        {agent.name} {agent.description && `- ${agent.description}`}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {personaFormErrors.agent_id && (
                <p className="text-sm text-destructive">{personaFormErrors.agent_id}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Choose the Mastra agent that will handle this assistant&apos;s logic
              </p>
            </div>

            <div className="space-y-2">
              <Label>AI Model</Label>
              <ModelSelector
                value={personaFormData.model_id || ''}
                onValueChange={(value) => handlePersonaInputChange('model_id', value)}
                placeholder="Select an AI model..."
                className="w-full"
              />
              {personaFormErrors.model_id && (
                <p className="text-sm text-destructive">{personaFormErrors.model_id}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Choose the AI model that will power this assistant (optional, can be set by agent)
              </p>
            </div>

            <div className="space-y-2">
              <Label>Greeting Message</Label>
              <Textarea
                placeholder="Hi! I'm here to help you manage your calendar effectively..."
                value={personaFormData.greeting}
                onChange={(e) => handlePersonaInputChange('greeting', e.target.value)}
                rows={2}
              />
              {personaFormErrors.greeting && (
                <p className="text-sm text-destructive">{personaFormErrors.greeting}</p>
              )}
              <p className="text-xs text-muted-foreground">
                How the assistant introduces itself to users
              </p>
            </div>

            <div className="space-y-2">
              <Label>Personality Traits</Label>
              <Textarea
                placeholder="Describe your assistant's personality traits, communication style, and approach to helping users..."
                value={personaFormData.traits}
                onChange={(e) => handlePersonaInputChange('traits', e.target.value)}
                rows={4}
              />
              {personaFormErrors.traits && (
                <p className="text-sm text-destructive">{personaFormErrors.traits}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Define how your assistant communicates and interacts with users
              </p>
            </div>

            <div className="space-y-2">
              <Label>Detailed Instructions</Label>
              <Textarea
                placeholder="Provide specific instructions for how this assistant should behave, what it should focus on, and any special guidelines..."
                value={personaFormData.instructions}
                onChange={(e) => handlePersonaInputChange('instructions', e.target.value)}
                rows={6}
              />
              {personaFormErrors.instructions && (
                <p className="text-sm text-destructive">{personaFormErrors.instructions}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Detailed guidelines for how the assistant should operate
              </p>
            </div>

            <div className="space-y-2">
              <Label>Response Creativity: {personaFormData.temperature?.toFixed(1)}</Label>
              <Slider
                value={[personaFormData.temperature || 0.7]}
                onValueChange={(value) => handlePersonaInputChange('temperature', value[0])}
                max={2}
                min={0}
                step={0.1}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>More Focused</span>
                <span>More Creative</span>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="is-default"
                checked={personaFormData.is_default || false}
                onCheckedChange={(checked) => handlePersonaInputChange('is_default', checked)}
              />
              <Label htmlFor="is-default">Set as default persona</Label>
            </div>

            {/* Agent Details Section */}
            {personaFormData.agent_id &&
              (() => {
                const selectedAgent = agents.find((a) => a.id === personaFormData.agent_id);
                if (!selectedAgent) return null;

                const toolsList = selectedAgent.tools ? Object.entries(selectedAgent.tools) : [];

                return (
                  <Card className="mt-6">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Zap className="h-4 w-4" />
                        Agent Configuration
                      </CardTitle>
                      <CardDescription>
                        Technical details about the selected Mastra agent
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Agent Metadata Grid */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Agent ID</Label>
                          <p className="text-sm font-mono">{selectedAgent.id}</p>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Agent Name</Label>
                          <p className="text-sm">{selectedAgent.name || selectedAgent.id}</p>
                        </div>
                        {selectedAgent.provider && (
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Provider</Label>
                            <p className="text-sm">{selectedAgent.provider}</p>
                          </div>
                        )}
                        {selectedAgent.modelId && (
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Default Model</Label>
                            <p className="text-sm font-mono">{selectedAgent.modelId}</p>
                          </div>
                        )}
                      </div>

                      {/* Tools Section */}
                      {toolsList.length > 0 && (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <Label className="text-sm font-medium">Available Tools</Label>
                            <Badge variant="secondary">{toolsList.length}</Badge>
                          </div>
                          <div className="space-y-2">
                            {toolsList.map(([toolId, tool]: [string, any]) => (
                              <div
                                key={toolId}
                                className="rounded-lg border bg-card p-3 space-y-1.5"
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <code className="text-sm font-medium">{toolId}</code>
                                  <Box className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0 mt-0.5" />
                                </div>
                                {tool.description && (
                                  <p className="text-xs text-muted-foreground leading-relaxed">
                                    {tool.description}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })()}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <h3 className="text-lg font-medium">AI Assistants</h3>
          <p className="text-sm text-muted-foreground">
            Manage your AI assistants and their personalities.
          </p>
        </div>
        <Button
          onClick={() => {
            startEditingPersona({
              id: 'new',
              name: '',
              temperature: 0.7,
              is_default: false,
            } as ClientPersona);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add New Assistant
        </Button>
      </div>

      <div className="space-y-4">
        {aiPersonas.map((persona: ClientPersona) => {
          const initials = persona.name
            .split(' ')
            .map((n: string) => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);

          const traitsPreview = persona.traits
            ? persona.traits.split('\n').slice(0, 3).join('\n') +
              (persona.traits.split('\n').length > 3 ? '...' : '')
            : 'No traits defined';

          return (
            <Card
              key={persona.id}
              className="group cursor-pointer transition-colors hover:bg-muted/50"
              onClick={() => {
                startEditingPersona(persona);
              }}
            >
              <CardContent className="px-4 py-2">
                <div className="flex items-start gap-4">
                  <Avatar className="w-12 h-12">
                    <AvatarImage
                      src={getAvatarUrl(persona.avatar_url) || undefined}
                      alt={persona.name}
                    />
                    <AvatarFallback className="text-sm font-medium">{initials}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium truncate">{persona.name}</h4>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => {
                            e.stopPropagation();
                          }}
                          title="View memories (disabled)"
                          disabled
                        >
                          <Brain className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (!user?.id) return;
                            try {
                              await deleteAIPersona(user.id, persona.id);
                              toast.success('AI persona deleted successfully');
                            } catch (error) {
                              console.error('Failed to delete persona:', error);
                              const errorMessage =
                                error instanceof Error ? error.message : 'Failed to delete persona';
                              toast.error(errorMessage);
                            }
                          }}
                          disabled={aiPersonas.length <= 1}
                          title={
                            aiPersonas.length <= 1
                              ? 'Cannot delete your last persona'
                              : 'Delete persona'
                          }
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                        <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-3 whitespace-pre-wrap">
                      {traitsPreview}
                    </p>
                    {persona.is_default && (
                      <div className="mt-2">
                        <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
                          Default
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
