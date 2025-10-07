import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

export const getUserCategoriesTool = createTool({
  id: 'getUserCategories',
  description:
    "Get all of the user's event categories with their properties (name, color, default status).",
  inputSchema: z.object({}),
  execute: async (executionContext) => {
    const jwt = executionContext.runtimeContext?.get('jwt-token');

    if (!jwt) {
      return {
        success: false,
        error: 'Authentication required',
      };
    }

    try {
      const response = await fetch(
        `${process.env.SUPABASE_URL}/rest/v1/user_categories?select=*&order=created_at.asc`,
        {
          headers: {
            Authorization: `Bearer ${jwt}`,
            apikey: process.env.SUPABASE_ANON_KEY!,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        return {
          success: false,
          error: `Failed to fetch categories: ${response.statusText}`,
        };
      }

      const categories = await response.json();

      return {
        success: true,
        categories,
        count: categories.length,
        message: `Found ${categories.length} categor${categories.length === 1 ? 'y' : 'ies'}`,
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to fetch categories: ${error.message}`,
      };
    }
  },
});

export const createUserCategoryTool = createTool({
  id: 'createUserCategory',
  description: 'Create a new event category for the user.',
  inputSchema: z.object({
    name: z.string().describe('Category name'),
    color: z
      .enum([
        'neutral',
        'slate',
        'orange',
        'yellow',
        'green',
        'blue',
        'indigo',
        'violet',
        'fuchsia',
        'rose',
      ])
      .optional()
      .describe('Category color'),
  }),
  execute: async (executionContext) => {
    const jwt = executionContext.runtimeContext?.get('jwt-token');

    if (!jwt) {
      return {
        success: false,
        error: 'Authentication required',
      };
    }

    const { name, color } = executionContext.context;

    if (!name?.trim()) {
      return {
        success: false,
        error: 'Category name is required',
      };
    }

    try {
      const categoryData = {
        name: name.trim(),
        color: color || 'blue',
        is_default: false, // Never allow agent to create default categories
      };

      const response = await fetch(`${process.env.SUPABASE_URL}/rest/v1/user_categories`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${jwt}`,
          apikey: process.env.SUPABASE_ANON_KEY!,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify(categoryData),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          error: `Failed to create category: ${response.statusText} - ${errorText}`,
        };
      }

      const newCategory = await response.json();

      return {
        success: true,
        category: newCategory[0],
        message: `Created category "${name}"`,
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to create category: ${error.message}`,
      };
    }
  },
});

export const updateUserCategoryTool = createTool({
  id: 'updateUserCategory',
  description:
    'Update an existing user category. Can modify name or color. Cannot change default category status.',
  inputSchema: z.object({
    categoryId: z.string().describe('ID of the category to update'),
    name: z.string().optional().describe('New category name'),
    color: z
      .enum([
        'neutral',
        'slate',
        'orange',
        'yellow',
        'green',
        'blue',
        'indigo',
        'violet',
        'fuchsia',
        'rose',
      ])
      .optional()
      .describe('New category color'),
  }),
  execute: async (executionContext) => {
    const jwt = executionContext.runtimeContext?.get('jwt-token');

    if (!jwt) {
      return {
        success: false,
        error: 'Authentication required',
      };
    }

    const { categoryId, name, color } = executionContext.context;

    if (!categoryId) {
      return {
        success: false,
        error: 'Category ID is required',
      };
    }

    if (!name && !color) {
      return {
        success: false,
        error: 'At least one field must be provided to update',
      };
    }

    try {
      const updateData: any = {};
      if (name?.trim()) updateData.name = name.trim();
      if (color) updateData.color = color;

      const response = await fetch(
        `${process.env.SUPABASE_URL}/rest/v1/user_categories?id=eq.${categoryId}`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${jwt}`,
            apikey: process.env.SUPABASE_ANON_KEY!,
            'Content-Type': 'application/json',
            Prefer: 'return=representation',
          },
          body: JSON.stringify(updateData),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          error: `Failed to update category: ${response.statusText} - ${errorText}`,
        };
      }

      const updatedCategory = await response.json();

      if (updatedCategory.length === 0) {
        return {
          success: false,
          error: 'Category not found or access denied',
        };
      }

      const updates = [];
      if (name) updates.push(`name to "${name}"`);
      if (color) updates.push(`color to ${color}`);

      return {
        success: true,
        category: updatedCategory[0],
        message: `Updated category: ${updates.join(', ')}`,
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to update category: ${error.message}`,
      };
    }
  },
});

export const deleteUserCategoryTool = createTool({
  id: 'deleteUserCategory',
  description: `Delete a user-created event category (like "Work", "Personal", etc.).

WHAT ARE CATEGORIES: Event classification labels that organize calendar events
NOT FOR: Deleting highlights, events, or calendars (use their respective delete tools)

EXAMPLES:
- "Delete my Work category" ← Use this tool
- "Remove the Personal category I created" ← Use this tool
- "Remove the highlight on Sally's meeting" ← DON'T use this tool (use deleteHighlights)
- "Delete Sally's meeting" ← DON'T use this tool (use deleteCalendarEvent)

Cannot delete the default category.`,
  inputSchema: z.object({
    categoryId: z.string().describe('ID of the category to delete'),
  }),
  execute: async (executionContext) => {
    const jwt = executionContext.runtimeContext?.get('jwt-token');

    if (!jwt) {
      return {
        success: false,
        error: 'Authentication required',
      };
    }

    const { categoryId } = executionContext.context;

    if (!categoryId) {
      return {
        success: false,
        error: 'Category ID is required',
      };
    }

    try {
      // First check if this is a default category
      const checkResponse = await fetch(
        `${process.env.SUPABASE_URL}/rest/v1/user_categories?id=eq.${categoryId}&select=name,is_default`,
        {
          headers: {
            Authorization: `Bearer ${jwt}`,
            apikey: process.env.SUPABASE_ANON_KEY!,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!checkResponse.ok) {
        return {
          success: false,
          error: `Failed to check category: ${checkResponse.statusText}`,
        };
      }

      const categories = await checkResponse.json();

      if (categories.length === 0) {
        return {
          success: false,
          error: 'Category not found or access denied',
        };
      }

      const category = categories[0];

      if (category.is_default) {
        return {
          success: false,
          error: 'Cannot delete the default category',
        };
      }

      // Delete the category
      const deleteResponse = await fetch(
        `${process.env.SUPABASE_URL}/rest/v1/user_categories?id=eq.${categoryId}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${jwt}`,
            apikey: process.env.SUPABASE_ANON_KEY!,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!deleteResponse.ok) {
        const errorText = await deleteResponse.text();
        return {
          success: false,
          error: `Failed to delete category: ${deleteResponse.statusText} - ${errorText}`,
        };
      }

      return {
        success: true,
        message: `Deleted category "${category.name}"`,
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to delete category: ${error.message}`,
      };
    }
  },
});
