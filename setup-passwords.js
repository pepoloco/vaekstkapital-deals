#!/usr/bin/env node
/**
 * Kør dette script ÉN gang for at generere password hashes.
 * 
 * Brug:
 *   node setup-passwords.js
 * 
 * Scriptet opdaterer automatisk src/lib/users.ts med de rigtige hashes.
 */

const bcrypt = require('bcryptjs')
const fs = require('fs')
const path = require('path')
const readline = require('readline')

const USERS = [
  { id: '1', name: 'Kamilla Jensen', email: 'kmj@vaekstnet.com' },
  { id: '2', name: 'Admin',          email: 'admin@vaekstnet.com' },
  // Tilføj flere brugere her hvis nødvendigt:
  // { id: '3', name: 'Navn', email: 'email@vaekstnet.com' },
]

const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
const ask = (q) => new Promise(resolve => rl.question(q, resolve))

async function main() {
  console.log('\n🔐 VaekstNet Dashboard — Password Setup\n')
  console.log('Indtast et password for hver bruger.\n')

  const results = []
  for (const user of USERS) {
    const pw = await ask(`Password for ${user.name} (${user.email}): `)
    const hash = bcrypt.hashSync(pw.trim(), 10)
    results.push({ ...user, passwordHash: hash })
    console.log(`  ✓ Hash genereret for ${user.name}\n`)
  }

  rl.close()

  // Skriv til users.ts
  const usersFile = path.join(__dirname, 'src', 'lib', 'users.ts')
  const content = `// Auto-genereret af setup-passwords.js
// Kør IKKE dette script igen medmindre du vil skifte passwords.

export const USERS = [
${results.map(u => `  {
    id: "${u.id}",
    name: "${u.name}",
    email: "${u.email}",
    passwordHash: "${u.passwordHash}",
  }`).join(',\n')}
]
`
  fs.writeFileSync(usersFile, content)
  console.log(`\n✅ Passwords gemt i src/lib/users.ts`)
  console.log('   Du kan nu deploye projektet.\n')
}

main().catch(console.error)
