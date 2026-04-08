import { describe, it, expect } from 'vitest'
import { BUILTIN_ROLES, hasPermission } from '@spaces-dooh/utils'
import type { AuthUser } from '@spaces-dooh/types'

function makeUser(rol: string): AuthUser {
  const permisos = (BUILTIN_ROLES[rol] ?? []) as AuthUser['permisos']
  return { id: 'test', tenantId: 'test', rol, permisos }
}

describe('BUILTIN_ROLES y hasPermission()', () => {
  describe('owner', () => {
    it('tiene cualquier permiso', () => {
      const user = makeUser('owner')
      expect(hasPermission(user, 'sitios:read')).toBe(true)
      expect(hasPermission(user, 'audit:read')).toBe(true)
      expect(hasPermission(user, 'roles:manage')).toBe(true)
    })
  })

  describe('admin', () => {
    it('tiene cualquier permiso', () => {
      const user = makeUser('admin')
      expect(hasPermission(user, 'campanas:confirm')).toBe(true)
      expect(hasPermission(user, 'users:manage')).toBe(true)
      expect(hasPermission(user, 'tenant:manage')).toBe(true)
    })
  })

  describe('seller', () => {
    it("tiene 'inventario:read'", () => {
      expect(hasPermission(makeUser('seller'), 'inventario:read')).toBe(true)
    })

    it("NO tiene 'inventario:read_costs'", () => {
      expect(hasPermission(makeUser('seller'), 'inventario:read_costs')).toBe(false)
    })

    it("NO tiene 'campanas:confirm'", () => {
      expect(hasPermission(makeUser('seller'), 'campanas:confirm')).toBe(false)
    })
  })

  describe('crew_chief', () => {
    it("tiene 'ots:complete'", () => {
      expect(hasPermission(makeUser('crew_chief'), 'ots:complete')).toBe(true)
    })

    it("NO tiene 'ots:create'", () => {
      expect(hasPermission(makeUser('crew_chief'), 'ots:create')).toBe(false)
    })
  })

  describe('auditor', () => {
    it("tiene 'campanas:read'", () => {
      expect(hasPermission(makeUser('auditor'), 'campanas:read')).toBe(true)
    })

    it("NO tiene 'campanas:create'", () => {
      expect(hasPermission(makeUser('auditor'), 'campanas:create')).toBe(false)
    })
  })

  describe('trafficker', () => {
    it("tiene 'traffic:manage'", () => {
      expect(hasPermission(makeUser('trafficker'), 'traffic:manage')).toBe(true)
    })

    it("NO tiene 'campanas:confirm'", () => {
      expect(hasPermission(makeUser('trafficker'), 'campanas:confirm')).toBe(false)
    })
  })
})
