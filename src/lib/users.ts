import bcrypt from "bcryptjs"

const SHARED_PASSWORD_HASH = "$2a$12$BagCgih/PAqGBsmnLPD95eMqqeg9ml1jtfchBoV6X52Az.Bh4bAkW"

const ALLOWED_DOMAINS = [
  "vaekstnet.com",
  "vaekstkapital.com",
  "vaekstkapital.dk",
  "vaekstkapital.se",
  "vaekstkapital.at",
  "vk-shipping.com",
  "vkfunddistribution.com",
  "vaekstholdings.com",
]

export const USERS = [
  { id: "1", name: "Kamilla Jensen",  email: "kmj@vaekstnet.com",          passwordHash: SHARED_PASSWORD_HASH },
  { id: "2", name: "Admin",           email: "admin@vaekstnet.com",         passwordHash: SHARED_PASSWORD_HASH },
  { id: "3", name: "PKB",             email: "pkb@vkfunddistribution.com",  passwordHash: SHARED_PASSWORD_HASH },
  { id: "4", name: "Jens",            email: "jens@vaekstholdings.com",     passwordHash: SHARED_PASSWORD_HASH },
  { id: "5", name: "BRJ",             email: "brj@vaekstkapital.dk",        passwordHash: SHARED_PASSWORD_HASH },
]

export function findUserByEmail(email: string) {
  const lower = email.toLowerCase()
  
  // Tjek om emailen matcher en specifik bruger
  const exact = USERS.find(u => u.email.toLowerCase() === lower)
  if (exact) return exact

  // Tjek om emailen tilhører et godkendt domæne
  const domain = lower.split("@")[1]
  if (domain && ALLOWED_DOMAINS.includes(domain)) {
    return {
      id: lower,
      name: email.split("@")[0],
      email: lower,
      passwordHash: SHARED_PASSWORD_HASH,
    }
  }

  return null
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash)
}
