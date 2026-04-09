'use client'

import { useState, useEffect } from 'react'

export function useIsMobile(breakpoint = 768): boolean | null {
  // null = not yet hydrated (avoids SSR flash)
  const [isMobile, setIsMobile] = useState<boolean | null>(null)

  useEffect(() => {
    function check() {
      setIsMobile(window.innerWidth < breakpoint)
    }
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [breakpoint])

  return isMobile
}
