'use client'

import type { ReactNode } from 'react'
import { useAuth } from '@/lib/auth-context'
import type { Permission } from '@spaces-dooh/types'

interface PermissionGuardProps {
  permission: Permission
  children: ReactNode
  fallback?: ReactNode
}

export function PermissionGuard({ permission, children, fallback = null }: PermissionGuardProps) {
  const { user } = useAuth()

  if (!user) return null

  const hasPermission =
    user.rol === 'owner' ||
    user.rol === 'admin' ||
    (user.permisos as string[]).includes('*') ||
    user.permisos.includes(permission)

  if (!hasPermission) return <>{fallback}</>

  return <>{children}</>
}
