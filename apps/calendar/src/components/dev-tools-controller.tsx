'use client';

import { useAppStore } from '@/store/app';

export function DevToolsController() {
  const { devToolsVisible } = useAppStore();

  return (
    <>
      {!devToolsVisible && (
        <style jsx global>{`
          /* Hide Next.js dev indicators */
          [data-nextjs-build-activity] {
            display: none !important;
          }

          /* Hide any other Next.js dev overlays */
          [data-nextjs-toast] {
            display: none !important;
          }

          /* Hide Next.js error overlay when dev tools are off */
          [data-nextjs-dialog-overlay] {
            display: none !important;
          }
        `}</style>
      )}
    </>
  );
}