import pino from 'pino'
import { config } from '~/server/config'
import { useRequestContext } from './request'

export const logger = pino({
  level: config.env.isProd ? 'info' : 'debug',
  mixin() {
    const ctx = useRequestContext()
    return {
      ...ctx,
    }
  },
  ...(config.env.isDev
    ? {
        transport: {
          target: 'pino-pretty',
        },
      }
    : {}),
})
