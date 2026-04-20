/**
 * Tenant administration routes.
 * GET  /admin/tenant        → current tenant info
 * PATCH /admin/tenant       → update nombre / config
 * GET  /admin/connectors    → connector status list
 * PATCH /admin/connectors/:tipo → update connector credentials
 *
 * These routes are already registered through admin.routes.ts (adminExtRoutes).
 * This file re-exports the registration function so it can be mounted independently
 * when needed (e.g. dedicated tenant-admin service in the future).
 */
export { default } from './admin.routes'
