import * as winston from 'winston';
import DailyRotateFile = require('winston-daily-rotate-file');
import { join } from 'path';

// 로그 디렉토리 경로
const logDir = join(process.cwd(), 'apps', 'backend', 'logs');

// 로그 포맷 정의
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, stack, context }) => {
    const contextStr = context ? `[${context}] ` : '';
    const stackStr = stack ? `\n${stack}` : '';
    return `${timestamp} [${level.toUpperCase()}] ${contextStr}${message}${stackStr}`;
  }),
);

// Daily Rotate File Transport 설정 (일반 로그)
const dailyRotateFileTransport = new DailyRotateFile({
  dirname: join(logDir, 'daily'),
  filename: 'application-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '30d', // 30일 보관
  format: logFormat,
});

// Daily Rotate File Transport 설정 (에러 로그)
const dailyRotateErrorTransport = new DailyRotateFile({
  dirname: join(logDir, 'daily'),
  filename: 'error-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '30d',
  level: 'error',
  format: logFormat,
});

// Winston Logger 생성
export const winstonLogger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: logFormat,
  transports: [
    // 콘솔 출력 (개발 환경)
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, context }) => {
          const contextStr = context ? `[${context}] ` : '';
          return `${timestamp} ${level} ${contextStr}${message}`;
        }),
      ),
    }),
    // 일별 로그 파일
    dailyRotateFileTransport,
    dailyRotateErrorTransport,
    // 일반 파일 (기존 PM2 로그 유지)
    new winston.transports.File({
      filename: join(logDir, 'out.log'),
      level: 'info',
      maxsize: 10485760, // 10MB
      maxFiles: 5,
    }),
    new winston.transports.File({
      filename: join(logDir, 'error.log'),
      level: 'error',
      maxsize: 10485760,
      maxFiles: 5,
    }),
  ],
});

// NestJS Logger 인터페이스 구현
export class WinstonLoggerService {
  log(message: string, context?: string) {
    winstonLogger.info(message, { context });
  }

  error(message: string, trace?: string, context?: string) {
    winstonLogger.error(message, { stack: trace, context });
  }

  warn(message: string, context?: string) {
    winstonLogger.warn(message, { context });
  }

  debug(message: string, context?: string) {
    winstonLogger.debug(message, { context });
  }

  verbose(message: string, context?: string) {
    winstonLogger.verbose(message, { context });
  }
}
