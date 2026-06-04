import { NextResponse } from "next/server"

const BASE = "https://api.hubapi.com"
const KEY = process.env.HUBSPOT_API_KEY!

export async function GET() {
  try {
    const res = await fetch(`${BASE}/crm/v3/pipelines/deals`, {
      headers: { Authorization: `Bearer ${KEY}` },
      cache: "no-store",
    })
    const data = await res.json()
    
    const stages: Array<{pipeline: string; stage: string; id: string; type: string}> = []
    for (const pipeline of data.results ?? []) {
      for (const stage of pipeline.stages ?? []) {
        stages.push({
          pipeline: pipeline.label,
          stage: stage.label,
          id: stage.id,
          type: stage.metadata?.probability === "1.0" ? "WON" : stage.metadata?.probability === "0.0" ? "LOST" : "OPEN"
        })
      }
    }
    
    return NextResponse.json(stages)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
