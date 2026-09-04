import { createRequire } from 'node:module';

// AppModule reads NODE_ENV while it is imported. Force production first so a
// preflight can never enable TypeORM synchronize against the live database.
process.env.NODE_ENV = 'production';

const require = createRequire(import.meta.url);
const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('../apps/backend/dist/app.module.js');

let app;
try {
  app = await NestFactory.create(AppModule, {
    abortOnError: false,
    bodyParser: false,
    logger: false,
  });
  console.log('Production dependency preflight passed.');
} finally {
  await app?.close();
}
