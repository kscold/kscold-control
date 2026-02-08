import * as winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { join } from 'path';

const logDir = join(__dirname, '../../../logs');

// 로그 포맷 정의
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length
      ? JSON.stringify(meta, null, 2)
      : '';
    return `[${timestamp}] ${level.toUpperCase()}: ${message} ${metaStr}`;
  }),
);

// 일반 로그 (info, warn 등)
const dailyRotateTransport = new DailyRotateFile({
  level: 'info',
  dirname: logDir,
  filename: '%DATE%-app.log',
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '30d',
  format: logFormat,
});

// 에러 로그
const errorRotateTransport = new DailyRotateFile({
  level: 'error',
  dirname: logDir,
  filename: '%DATE%-error.log',
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '30d',
  format: logFormat,
});

// HTTP 요청 로그
const httpRotateTransport = new DailyRotateFile({
  level: 'http',
  dirname: join(logDir, 'http'),
  filename: '%DATE%-http.log',
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '30d',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.json(),
  ),
});

export const winstonLogger = winston.createLogger({
  levels: winston.config.npm.levels,
  transports: [
    dailyRotateTransport,
    errorRotateTransport,
    httpRotateTransport,
    // 개발 환경에서 콘솔 출력
    ...(process.env.NODE_ENV !== 'production'
      ? [
          new winston.transports.Console({
            format: winston.format.combine(
              winston.format.colorize(),
              winston.format.simple(),
            ),
          }),
        ]
      : []),
  ],
});
