import { type NextAuthOptions } from "next-auth"
import AzureADProvider from "next-auth/providers/azure-ad"

const ALLOWED_DOMAINS = [
  "vaekstnet.com",
  "vaekstkapital.com",
  "vaekstkapital.dk",
  "vaekstkapital.se",
  "vaekstkapital.at",
  "vaekstkapital.fi",
  "vaekstkapital.no",
  "vk-shipping.com",
  "vkfunddistribution.com",
  "vaekstholdings.com",
]

export const authOptions: NextAuthOptions = {
  providers: [
    AzureADProvider({
      clientId:     process.env.CLIENT_MICROSOFT!,
      clientSecret: process.env.Client_Secret!,
      tenantId:     "common",
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      const domain = (user.email ?? "").toLowerCase().split("@")[1] ?? ""
      return ALLOWED_DOMAINS.includes(domain)
    },
  },
  pages: { signIn: "/login", error: "/login" },
  session: { strategy: "jwt", maxAge: 24 * 60 * 60 },
  secret: process.env.NEXTAUTH_SECRET,
}
