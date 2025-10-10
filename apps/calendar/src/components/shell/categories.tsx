'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, Plus } from 'lucide-react';
import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useUserCategories } from '@/lib/data-v2';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/store/app';
import { Button } from '../ui/button';
import { Checkbox } from '../ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/collapsible';

export function Categories() {
  const { user } = useAuth();
  const categories = useUserCategories(user?.id) || [];
  const {
    hiddenCategoryIds,
    toggleCategoryVisibility,
    setSettingsModalOpen,
    sidebarTab,
    categoriesExpanded,
    setCategoriesExpanded,
  } = useAppStore();

  const handleToggleVisibility = (categoryId: string) => {
    toggleCategoryVisibility(categoryId);
  };

  const handleCreateCategory = () => {
    // Open settings modal to categories section for creation
    setSettingsModalOpen(true);
  };

  return (
    <AnimatePresence mode="wait">
      {sidebarTab === 'calendars' && (
        <motion.div
          key="categories-content"
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{
            duration: 0.3,
            ease: 'easeOut',
          }}
          className="flex flex-col border-t"
        >
          {/* Category List */}
          <Collapsible open={categoriesExpanded} onOpenChange={setCategoriesExpanded}>
            <div className="px-4 pt-4 pb-3">
              <div className="flex items-center justify-between">
                <CollapsibleTrigger className="flex items-center gap-1 hover:opacity-70 transition-opacity">
                  <h3 className="font-medium text-sm">Categories</h3>
                  <ChevronDown
                    className={cn(
                      'h-4 w-4 transition-transform',
                      categoriesExpanded ? 'transform rotate-0' : 'transform -rotate-90'
                    )}
                  />
                </CollapsibleTrigger>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCreateCategory}
                  className="h-8 w-8 p-0"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <CollapsibleContent className="px-2 pb-2 space-y-1">
              {categories.map((category) => {
                return (
                  <React.Fragment key={category.id}>
                    <div
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/50 transition-colors group cursor-pointer"
                      onClick={() => handleToggleVisibility(category.id)}
                    >
                      {/* Color indicator and checkbox */}
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <Checkbox
                          checked={
                            hiddenCategoryIds instanceof Set
                              ? !hiddenCategoryIds.has(category.id)
                              : true
                          }
                          onCheckedChange={() => handleToggleVisibility(category.id)}
                          className="shrink-0"
                        />
                        <div
                          className={cn('w-3 h-3 rounded-sm shrink-0', `bg-${category.color}-500`)}
                        />
                        <div className="flex flex-col min-w-0 flex-1">
                          <span className="text-sm font-medium truncate">{category.name}</span>
                        </div>
                      </div>
                    </div>
                  </React.Fragment>
                );
              })}
            </CollapsibleContent>
          </Collapsible>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
