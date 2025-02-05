import { createRequestHandler } from '@remix-run/vercel';
// @ts-ignore: Build output is generated at runtime.
import * as build from '../build/server/index.js';

export default createRequestHandler({
  build,
  mode: import.meta.env.NODE_ENV
});
