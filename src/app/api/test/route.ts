import { NextResponse } from "next/server"
import { readCache, writeCache } from "@/lib/cache"

export async function GET() {
  // Test med lille stykke data
  const testData = { seller: { scriveSellers: [{ name: "Test", deals: 1, amount: 100 }] }, auc: { total: 100 }, funnel: { created: 1 }, funds: [] }
  
  // Skriv
  await writeCache(testData)
  
  // Læs tilbage
  const read = await readCache()
  
  return NextResponse.json({
    wrote: testData,
    read: read,
    match: JSON.stringify(read) === JSON.stringify(testData),
    hasSeller: !!(read as Record<string, unknown>)?.seller,
  })
}
