#!/usr/bin/env node

import('./update-market.mjs').catch((error) => {
  console.error(error);
  process.exit(1);
});
