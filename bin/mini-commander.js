#!/usr/bin/env node
// Thin launcher. All real work lives in dist/cli.js so that the published
// package has exactly one entry point and zero runtime dependencies.
import { main } from '../dist/cli.js';

main(process.argv.slice(2)).then(
  (code) => process.exit(code),
  (err) => {
    // A crash should never look scary to a 7-year-old, but a grown-up
    // debugging it needs the real stack. MINI_COMMANDER_DEBUG=1 gives it.
    if (process.env.MINI_COMMANDER_DEBUG) {
      console.error(err);
    } else {
      console.error('\nCHIP fell over. Sorry!');
      console.error('Tell a grown-up: ' + (err?.message ?? String(err)));
      console.error('For the full details, run again with MINI_COMMANDER_DEBUG=1\n');
    }
    process.exit(1);
  },
);
