import { Injectable } from '@nestjs/common';
import { SENSITIVE_KEYS } from '../common/security/redact';
import { User } from '../users/entities/user.entity';
import { LoggerExecutionContext } from './logger.types';

type LogLevel = 'error' | 'warn' | 'debug' | 'verbose' | 'info';

@Injectable()
export class Logger {
  error(
    first: string | LoggerExecutionContext,
    second?: string | Record<string, any>,
    third?: Record<string, any>,
  ): Logger {
    return this.dispatch('error', first, second, third);
  }

  warn(
    first: string | LoggerExecutionContext,
    second?: string | Record<string, any>,
    third?: Record<string, any>,
  ): Logger {
    return this.dispatch('warn', first, second, third);
  }

  debug(
    first: string | LoggerExecutionContext,
    second?: string | Record<string, any>,
    third?: Record<string, any>,
  ): Logger {
    return this.dispatch('debug', first, second, third);
  }

  verbose(
    first: string | LoggerExecutionContext,
    second?: string | Record<string, any>,
    third?: Record<string, any>,
  ): Logger {
    return this.dispatch('verbose', first, second, third);
  }

  log(
    first: string | LoggerExecutionContext,
    second?: string | Record<string, any>,
    third?: Record<string, any>,
  ): Logger {
    return this.dispatch('info', first, second, third);
  }

  private dispatch(
    level: LogLevel,
    first: string | LoggerExecutionContext,
    second?: string | Record<string, any>,
    third?: Record<string, any>,
  ): Logger {
    if (typeof first === 'string') {
      return this.emit(level, first, second as Record<string, any> | undefined);
    }
    const message = second as string;
    const fromCtx = this.metaFromExecutionContext(first);
    const meta =
      fromCtx && third ? { ...third, ...fromCtx } : (fromCtx ?? third);
    return this.emit(level, message, meta);
  }

  private metaFromExecutionContext(
    req: LoggerExecutionContext,
  ): Record<string, any> | undefined {
    const user = (req as LoggerExecutionContext & { user?: User }).user;
    return {
      method: req.method,
      url: req.originalUrl ?? req.url,
      ...(user?.id ? { userId: user.id } : {}),
    };
  }

  private emit(
    level: LogLevel,
    message: string,
    meta?: Record<string, any>,
  ): Logger {
    const payload = {
      level,
      message,
      timestamp: new Date().toISOString(),
      ...this.sanitizeMeta(meta),
    };
    // Use stdout/stderr.write so logs flush under Docker (non-TTY pipes).
    const line = `${JSON.stringify(payload)}\n`;
    if (level === 'error') {
      process.stderr.write(line);
    } else {
      process.stdout.write(line);
    }

    return this;
  }

  private sanitizeMeta(
    meta?: Record<string, any>,
  ): Record<string, any> | undefined {
    if (!meta) {
      return undefined;
    }

    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(meta)) {
      if (SENSITIVE_KEYS.has(key)) {
        continue;
      }
      result[key] = value;
    }
    return result;
  }
}
