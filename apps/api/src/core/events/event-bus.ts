import { EventEmitter } from 'node:events'
import type { SpacesEvent } from '@spaces-dooh/types'

class SpacesEventBus {
  private emitter = new EventEmitter()

  emit<T extends SpacesEvent>(event: T): void {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[EventBus ${new Date().toISOString()}] ${event.type}`, event.payload)
    }
    this.emitter.emit(event.type, event.payload)
  }

  on<T extends SpacesEvent['type']>(
    type: T,
    handler: (payload: Extract<SpacesEvent, { type: T }>['payload']) => void,
  ): void {
    this.emitter.on(type, handler as (...args: unknown[]) => void)
  }

  off<T extends SpacesEvent['type']>(
    type: T,
    handler: (payload: Extract<SpacesEvent, { type: T }>['payload']) => void,
  ): void {
    this.emitter.off(type, handler as (...args: unknown[]) => void)
  }
}

export const eventBus = new SpacesEventBus()
