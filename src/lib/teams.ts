const BASE = "https://api.hubapi.com"
const key  = () => process.env.HUBSPOT_API_KEY!
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

/**
 * Returns the canonical owner names for all members of HubSpot teams
 * whose name contains (case-insensitive) `teamNameContains`.
 *
 * Includes both primary team and any sub-teams with matching names.
 *
 * Returns null when:
 *   - No matching team was found
 *   - HubSpot API call failed
 *   - Members could not be mapped to owner records
 *
 * Callers should treat null as "show all owners" — never crash on it.
 */
export async function getTeamOwnerNames(teamNameContains: string): Promise<string[] | null> {
  try {
    await sleep(80)
    const teamsRes = await fetch(
      `${BASE}/settings/v3/users/teams?includeMembers=true`,
      { headers: { Authorization: `Bearer ${key()}` }, cache: "no-store" }
    )
    if (!teamsRes.ok) {
      console.warn(`[teams] Teams API ${teamsRes.status} for "${teamNameContains}" — falling back to all owners`)
      return null
    }
    const teamsData = await teamsRes.json()

    const lower = teamNameContains.toLowerCase()
    const matchedUserIds = new Set<string>()
    let teamsMatched = 0

    for (const team of teamsData.results ?? []) {
      if ((team.name || "").toLowerCase().includes(lower)) {
        teamsMatched++
        for (const uid of team.userIds ?? team.memberUserIds ?? []) {
          matchedUserIds.add(String(uid))
        }
      }
    }

    if (teamsMatched === 0) {
      console.warn(`[teams] No HubSpot team matched "${teamNameContains}" — falling back to all owners`)
      return null
    }
    if (matchedUserIds.size === 0) {
      console.warn(`[teams] Team "${teamNameContains}" found but has no members — falling back to all owners`)
      return null
    }

    // Fetch owners (paginated) and map userId → full name
    const names: string[] = []
    let after: string | undefined

    do {
      await sleep(80)
      const url = `${BASE}/crm/v3/owners?limit=100${after ? `&after=${after}` : ""}`
      const res = await fetch(url, { headers: { Authorization: `Bearer ${key()}` }, cache: "no-store" })
      if (!res.ok) {
        console.warn(`[teams] Owners API ${res.status} — falling back to all owners`)
        return null
      }
      const d = await res.json()
      for (const o of d.results ?? []) {
        if (o.userId && matchedUserIds.has(String(o.userId))) {
          const name = [o.firstName, o.lastName].filter(Boolean).join(" ")
          if (name && !names.includes(name)) names.push(name)
        }
      }
      after = d.paging?.next?.after
    } while (after)

    if (names.length === 0) {
      console.warn(`[teams] "${teamNameContains}" members not found in owners list — falling back to all owners`)
      return null
    }

    console.log(`[teams] "${teamNameContains}": ${names.length} members → ${names.join(", ")}`)
    return names
  } catch (e) {
    console.error(`[teams] Error fetching "${teamNameContains}":`, e)
    return null
  }
}
