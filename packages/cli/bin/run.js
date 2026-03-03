#!/usr/bin/env node
import { run } from '@oclif/core';

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
