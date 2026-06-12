'use client'

import * as RTabs from '@radix-ui/react-tabs'
import { cn } from '@/lib/cn'

// Tabs planas en el lenguaje SET: subrayado del activo, 1px, sentence case.
export function Tabs({
  tabs,
  defaultValue,
  children,
}: {
  tabs: { value: string; label: string }[]
  defaultValue: string
  children: React.ReactNode
}) {
  return (
    <RTabs.Root defaultValue={defaultValue}>
      <RTabs.List className="flex gap-1 border-b border-border">
        {tabs.map((t) => (
          <RTabs.Trigger
            key={t.value}
            value={t.value}
            className={cn(
              '-mb-px border-b-2 border-transparent px-3 py-2 text-[13px] font-medium text-muted transition-colors duration-150',
              'hover:text-ink data-[state=active]:border-accent data-[state=active]:text-ink',
            )}
          >
            {t.label}
          </RTabs.Trigger>
        ))}
      </RTabs.List>
      {children}
    </RTabs.Root>
  )
}

export const TabPanel = RTabs.Content
