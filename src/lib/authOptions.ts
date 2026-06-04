import { type NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { findUserByEmail, verifyPassword } from "@/lib/users"

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Email & adgangskode",
      credentials: {
        email:    { label: "Email",       type: "email"    },
        password: { label: "Adgangskode", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null
        const user = findUserByEmail(credentials.email)
        if (!user) return null
        const ok = await verifyPassword(String(credentials.password), String(user.passwordHash))
        if (!ok) return null
        return { id: user.id, name: user.name, email: user.email }
      },
    }),
  ],
  pages: { signIn: "/login" },
  session: { strategy: "jwt", maxAge: 24 * 60 * 60 },
  secret: process.env.NEXTAUTH_SECRET,
}
