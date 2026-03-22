#!/usr/bin/env node
'use strict';
require('dotenv').config();
const readline = require('readline');
const { runMigrations } = require('../src/db/migrations');
const { runSeeds } = require('../src/db/seeds');
const authService = require('../src/services/authService');

runMigrations();
runSeeds();

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
rl.question('Username: ', (username) => {
  rl.question('Password: ', async (password) => {
    rl.close();
    try {
      await authService.createUser(username, password);
      console.log(`User "${username}" created.`);
    } catch (err) {
      console.error('Error:', err.message);
    }
    process.exit(0);
  });
});
