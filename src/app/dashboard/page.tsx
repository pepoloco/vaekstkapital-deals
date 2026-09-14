"use client"
// @ts-nocheck
import React, { Suspense, useEffect, useRef, useState } from "react"
import { useSession, signOut } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import { getAccess as resolveAccess, canReadRegion } from "@/lib/access"

const fmt = (n: number) => new Intl.NumberFormat("da-DK", { style: "currency", currency: "DKK", maximumFractionDigits: 0 }).format(n)
const fmtShort = (n: number) => n >= 1e6 ? (n/1e6).toFixed(1)+"M kr." : (n/1e3).toFixed(0)+"K kr."
const fmtSEK = (n: number) => new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 0 }).format(n) + " SEK"
const fmtShortSEK = (n: number) => n >= 1e6 ? (n/1e6).toFixed(1)+"M SEK" : (n/1e3).toFixed(0)+"K SEK"
const fmtUSD = (n: number) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n) + " USD"
const fmtShortUSD = (n: number) => n >= 1e6 ? (n/1e6).toFixed(1)+"M USD" : (n/1e3).toFixed(0)+"K USD"
const fmtEUR = (n: number) => new Intl.NumberFormat("de-AT", { maximumFractionDigits: 0 }).format(n) + " EUR"
const fmtShortEUR = (n: number) => n >= 1e6 ? (n/1e6).toFixed(1)+"M EUR" : (n/1e3).toFixed(0)+"K EUR"
const fmtNOK = (n: number) => new Intl.NumberFormat("nb-NO", { maximumFractionDigits: 0 }).format(n) + " NOK"
const fmtShortNOK = (n: number) => n >= 1e6 ? (n/1e6).toFixed(1)+"M NOK" : (n/1e3).toFixed(0)+"K NOK"

const MONTH_LABELS: Record<string,string> = {
  "2025-10":"Okt 25","2025-11":"Nov 25","2025-12":"Dec 25",
  "2026-01":"Jan 26","2026-02":"Feb 26","2026-03":"Mar 26","2026-04":"Apr 26",
  "2026-05":"Maj 26","2026-06":"Jun 26","2026-07":"Jul 26","2026-08":"Aug 26",
  "2026-09":"Sep 26","2026-10":"Okt 26","2026-11":"Nov 26","2026-12":"Dec 26",
}
const PORTAL = "144061788"
const SHIP_PORTAL = "147337911"

const C = {
  G: "#15624c", Gd: "rgba(21,97,76,.12)",
  P: "#5a4998", Pd: "rgba(90,73,152,.12)",
  A: "#96803a", Ad: "rgba(150,128,58,.13)",
  B: "#2d68b0", Bd: "rgba(45,104,176,.12)",
  MU: "#7a7e9a", TX: "#121428",
}
const tip = { backgroundColor:"#fff", borderColor:"rgba(18,20,40,.1)", borderWidth:1, titleColor:C.TX, bodyColor:"#3c3f5e", padding:10, cornerRadius:6, displayColors:false }
const gr = { color:"rgba(18,20,40,.05)" }
const sc = { x:{grid:gr,ticks:{color:C.MU,font:{size:10}}}, y:{grid:gr,ticks:{color:C.MU,font:{size:10}}} }
const th = {fontSize:10,fontWeight:600,letterSpacing:".07em",textTransform:"uppercase" as const,color:"var(--ink3)",padding:"7px 16px",textAlign:"left" as const,borderBottom:"1px solid var(--bdr)"}
const td = {padding:"9px 16px",borderBottom:"1px solid var(--bdr)",color:"var(--ink2)",fontSize:12}
const tdr = {...td, textAlign:"right" as const}

const Logo = ({ height, opacity }: { height: number; opacity?: number }) => (
  <svg height={height} viewBox="0 0 1657.53 498.83" xmlns="http://www.w3.org/2000/svg" style={{width:"auto", opacity: opacity ?? 1}}>
    <rect x="0" width="1657.53" height="498.83" fill="#121428"/>
    <g>
      <g>
        <path fill="#fff" d="M930.05,325v98.39h-5.9l-67.05-85.46v85.46h-7.17v-98.39h6.04l66.91,85.46v-85.46h7.17Z"/>
        <path fill="#fff" d="M1023.68,416.92v6.47h-67.89v-98.39h65.78v6.46h-58.61v38.8h52.43v6.33h-52.43v40.34h60.72Z"/>
        <path fill="#fff" d="M1077.19,331.46h-35.42v-6.46h78.01v6.46h-35.42v91.93h-7.17v-91.93Z"/>
        <g>
          <path fill="#fff" d="M449.1,276.19c-3-.95-5.25-2.78-6.77-5.5-1.51-2.71-3.1-6.8-4.79-12.26l-62.01-173.63c-.56-2.08-2.15-3.28-4.79-3.66-2.43,0-7.61-.56-15.5-1.69-4.69-.74-8.56-1.73-11.56-2.96-3-1.23-5.53-1.37-7.61-.42-1.13.56-1.69,1.41-1.69,2.54l-58.63,166.3c-3.38,10.15-6.45,17.65-9.16,22.55-2.71,4.9-5.78,7.79-9.16,8.74-1.51.56-2.71,1.16-3.66,1.83-.95.67-1.41,1.55-1.41,2.68,0,2.26,1.8,3.28,5.36,3.1,2.64-.18,5.6-.32,8.88-.42s6.45-.14,9.44-.14c6.38,0,12.09.04,17.05.14s8.77.25,11.42.42c3.38.18,5.07-.85,5.07-3.1,0-2.08-1.58-3.56-4.79-4.51-7.72-1.13-12.3-4.09-13.81-8.88-1.51-4.79-.67-12.26,2.54-22.41l8.46-26.5h76.67l12.97,40.03c1.69,5.46,2.5,9.55,2.4,12.26s-1.45,4.65-4.09,5.78c-1.3.56-2.36,1.13-3.1,1.69-.74.56-1.13,1.41-1.13,2.54,0,2.26,1.69,3.28,5.07,3.1,2.64-.18,6.31-.39,10.99-.56,4.69-.18,10.82-.28,18.32-.28,7.89,0,13.99.11,18.32.28,4.33.18,7.79.39,10.43.56,3.56.18,5.36-.85,5.36-3.1,0-1.13-.46-2.01-1.41-2.68-.95-.67-2.15-1.27-3.66-1.83ZM305.62,206.85l34.39-107.11,34.95,107.11h-69.34Z"/>
          <path fill="#fff" d="M622.45,235.6c-2.82-.39-4.69,1.02-5.64,4.23-1.69,5.25-3.42,9.9-5.21,13.95-1.8,4.05-3.95,7.43-6.48,10.15-2.54,2.71-5.64,4.79-9.3,6.2-3.66,1.41-8.32,2.11-13.95,2.11h-46.51c-3.77,0-6.34-.77-7.75-2.4-1.41-1.59-2.12-4.26-2.12-8.03v-81.18h24.8c6.2,0,11.38.39,15.5,1.13,4.12.74,7.47,1.97,10.01,3.66s4.4,3.81,5.64,6.34c1.23,2.54,2.01,5.5,2.4,8.88.18,3.56,1.69,5.36,4.51,5.36s3.95-1.97,3.38-5.92c-.18-2.43-.32-5.64-.42-9.58-.11-3.95-.14-9.13-.14-15.5s.04-11.59.14-15.64c.11-4.05.25-7.36.42-10.01.56-3.95-.56-5.92-3.38-5.92-2.43,0-3.95,1.59-4.51,4.79-.39,3.56-1.16,6.66-2.4,9.3-1.23,2.64-3.1,4.83-5.64,6.62-2.54,1.8-5.88,3.1-10.01,3.95-4.12.85-9.3,1.27-15.5,1.27h-24.8v-78.36h54.12c5.64,0,10.18.39,13.67,1.13,3.49.74,6.45,2.15,8.88,4.23,2.43,2.08,4.47,4.86,6.06,8.32,1.59,3.49,3.24,7.93,4.93,13.39,1.13,3.21,3,4.62,5.64,4.23,2.64,0,3.66-1.8,3.1-5.36-.39-3.38-.71-6.38-.99-9.02-.28-2.64-.53-5.21-.71-7.75-.18-2.54-.32-5.14-.42-7.89-.11-2.71-.32-5.78-.71-9.16-.18-3.38-2.25-4.9-6.2-4.51-2.64.39-6.52.6-11.7.7-5.18.11-12.37.14-21.56.14h-105.42c-2.08,0-3.49.28-4.23.85-.74.56-1.13,1.41-1.13,2.54,0,.95.53,1.73,1.55,2.4,1.02.67,2.29,1.37,3.81,2.11,2.64,1.3,4.23,3.42,4.79,6.34.56,2.92.85,7.36.85,13.39v149.11c0,5.64-.28,10.01-.85,13.11-.56,3.1-2.15,5.32-4.79,6.62-1.52.74-2.78,1.44-3.81,2.11-1.02.67-1.55,1.55-1.55,2.68,0,2.08,1.69,3.1,5.07,3.1h107.96c9.41,0,16.67.04,21.84.14,5.18.11,9.06.32,11.7.7,3.77.39,5.74-1.13,5.92-4.51.56-6.94,1.16-13.49,1.83-19.59.67-6.1,1.44-12.65,2.4-19.59.39-3.56-.67-5.36-3.1-5.36Z"/>
          <path fill="#fff" d="M830.75,276.19h0c-3.21-.95-6.1-2.78-8.74-5.5-2.64-2.71-5.53-6.8-8.74-12.26l-64.27-111.34,27.35-35.81c8.87-13.33,31.68-21.63,47.51-24.94,10.7-2.24,14.94-5.55,5.68-6.92h-47.32s-78.89,108.54-78.89,108.54v-83.15c0-4.9.32-8.84.99-11.84.67-2.99,2.29-4.97,4.93-5.92,1.51-.74,2.71-1.41,3.66-1.97.95-.56,1.41-1.41,1.41-2.54,0-2.25-1.8-3.28-5.36-3.1-2.64.18-6.34.39-11.13.56-4.79.18-10.57.28-17.34.28s-12.79-.11-17.47-.28c-4.69-.18-8.35-.39-10.99-.56-3.56-.18-5.36.85-5.36,3.1,0,1.13.42,1.97,1.27,2.54.85.56,2.01,1.23,3.52,1.97,2.82.95,4.54,2.92,5.21,5.92.67,3,.99,6.94.99,11.84v153.62c0,4.9-.32,8.84-.99,11.84-.67,2.99-2.4,4.97-5.21,5.92-1.52.74-2.68,1.41-3.52,1.97s-1.27,1.41-1.27,2.54c0,2.26,1.8,3.28,5.36,3.1,2.64-.18,6.31-.39,10.99-.56,4.69-.18,10.53-.28,17.47-.28s12.54.11,17.34.28c4.79.18,8.49.39,11.13.56,3.56.18,5.36-.85,5.36-3.1,0-1.13-.46-1.97-1.41-2.54-.95-.56-2.15-1.23-3.66-1.97-2.64-.95-4.26-2.92-4.93-5.92-.67-3-.99-6.94-.99-11.84v-53.56l18.89-23.68,43.41,77.23c2.08,3.77,3.63,7.22,4.65,10.43,1.02,3.21.81,5.53-.71,7.05-1.3,1.13-2.36,1.94-3.1,2.4-.74.46-1.13,1.27-1.13,2.4,0,2.26,1.69,3.28,5.07,3.1,2.64-.18,6.34-.39,11.13-.56,4.79-.18,10.68-.28,17.62-.28s13.49.11,19.03.28c5.53.18,9.62.39,12.26.56,3.56.18,5.36-.85,5.36-3.1,0-1.13-.46-2.01-1.41-2.68-.95-.67-2.15-1.27-3.66-1.83Z"/>
          <path fill="#fff" d="M1171.7,122.57c-.56-3.77-1.02-7.19-1.41-10.29h0c-.39-3.1-.74-6.2-1.13-9.3-.39-3.1-.7-6.24-.99-9.44-.28-3.21-.53-6.66-.71-10.43-.18-3.38-2.25-4.9-6.2-4.51-3,.18-6.8.39-11.42.56-4.62.18-11.87.28-21.84.28h-98.23c-3.49,0-6.48-.03-9.02-.14s-4.69-.18-6.48-.28c-1.8-.11-3.42-.25-4.93-.42-3.95-.39-6.03,1.13-6.2,4.51-.18,3.77-.42,7.22-.7,10.43-.28,3.21-.6,6.34-.99,9.44-.39,3.1-.74,6.2-1.13,9.3-.39,3.1-.85,6.52-1.41,10.29-.56,3.38.46,5.25,3.1,5.64,2.64,0,4.51-1.52,5.64-4.51,1.87-5.25,3.7-9.9,5.5-13.95,1.8-4.05,3.95-7.47,6.48-10.29,2.54-2.82,5.6-4.93,9.16-6.34,3.56-1.41,8.17-2.11,13.81-2.11h20.01v167.43c0,4.9-.39,8.84-1.13,11.84-.74,2.99-2.43,4.97-5.07,5.92-1.52.74-2.68,1.41-3.52,1.97-.84.56-1.27,1.41-1.27,2.54,0,2.26,1.69,3.28,5.07,3.1,2.64-.18,6.31-.39,10.99-.56,4.69-.18,10.53-.28,17.48-.28s12.82.11,17.62.28c4.79.18,8.49.39,11.13.56,3.38.18,5.08-.85,5.08-3.1,0-1.13-.42-1.97-1.27-2.54s-2.01-1.23-3.52-1.97c-2.64-.95-4.33-2.92-5.07-5.92-.74-3-1.13-6.94-1.13-11.84V91h20.01c5.64,0,10.25.7,13.81,2.11,3.56,1.41,6.62,3.52,9.16,6.34,2.54,2.82,4.69,6.24,6.48,10.29,1.8,4.05,3.63,8.7,5.5,13.95,1.13,3.03,2.92,4.51,5.36,4.51,2.82-.39,3.95-2.25,3.38-5.64Z"/>
          <path fill="#fff" d="M276.69,96.19c2.78-5.02,5.92-7.98,9.39-8.95,1.55-.58,2.78-1.19,3.75-1.88.97-.69,1.44-1.59,1.44-2.74,0-2.31-1.84-3.36-5.49-3.18-2.71.18-5.74.32-9.1.43-3.36.11-6.61.14-9.67.14-6.53,0-12.38-.04-17.47-.14-5.09-.11-8.99-.25-11.7-.43-3.47-.18-5.2.87-5.2,3.18,0,2.13,1.62,3.65,4.91,4.62,7.91,1.16,12.6,4.19,14.15,9.1,1.55,4.91.69,12.56-2.6,22.96l-40.53,126.49-51.85-140.98c-1.87-5.46-3-9.41-3.38-11.84-.39-2.43.39-4.33,2.25-5.64,1.51-.95,2.68-1.66,3.52-2.11.85-.46,1.27-1.34,1.27-2.68,0-2.25-1.8-3.28-5.36-3.1-2.64.18-6.34.39-11.13.56-4.79.18-10.68.28-17.62.28s-12.65-.11-17.62-.28c-4.97-.18-8.77-.39-11.42-.56-3.56-.18-5.36.85-5.36,3.1,0,1.13.46,2.01,1.41,2.68.95.67,2.15,1.27,3.66,1.83,2.64.74,4.97,2.36,7.05,4.79,2.08,2.43,4.41,6.76,7.05,12.97l71.31,179.27c1.3,2.99,3.21,3.95,5.64,2.82l16.63-5.07c3.24-1.38,4.57-.77,5.64-4.51l57.02-158.02c3.47-10.4,6.61-18.09,9.39-23.11Z"/>
          <path fill="#fff" d="M981.27,179.65c-7.89-4.97-16.74-9.2-26.5-12.68-9.76-3.49-19.35-7.01-28.75-10.57-9.41-3.56-18.08-7.58-26.07-11.98-8-4.4-14.06-10.01-18.18-16.77-2.64-4.69-3.52-9.69-2.68-14.94.84-5.25,3.07-10.15,6.62-14.66,3.56-4.51,8.32-8.21,14.23-11.13,5.92-2.92,12.65-2.45,20.15-2.06,5.63.3,21.39,5.98,24.87,7.57,3.48,1.59,6.43,3.87,8.82,6.81,2.39,2.95,4.35,6.47,5.93,10.61,1.58,4.14,3.17,8.88,4.76,14.22.97,3.05,2.75,4.66,5.39,4.8,2.66-.25,3.78-2.06,3.39-5.47-.36-3.79-.64-7.23-.87-10.35-.22-3.12-.41-6.23-.64-9.35-.22-3.12-.38-6.26-.49-9.48-.11-3.22-.18-6.68-.16-10.45,0-3.39-1.99-5.01-5.95-4.83-1.52.1-3.15.15-4.95.16-1.8.01-3.95-.03-6.49-.06-2.54-.03-5.53-.15-9.02-.33l-23.19-1.2c-11.66,0-22.27-.3-31.85,2.62-9.58,2.92-17.76,7.05-24.52,12.4-6.77,5.36-11.94,11.66-15.5,18.89-3.56,7.22-5.36,15.26-5.36,24.1.18,10.71,2.92,19.59,8.17,26.64,5.25,7.05,11.87,12.93,19.87,17.62,8,4.69,16.8,8.74,26.5,12.12,9.69,3.38,18.89,6.8,27.62,10.29,8.74,3.49,16.52,7.43,23.4,11.84,6.87,4.4,11.52,10.11,13.95,17.05,1.87,5.46,2.26,11.1,1.13,16.91-1.13,5.81-3.42,11.13-6.9,15.93-3.49,4.79-8.14,8.7-13.95,11.7-5.81,3-12.58,4.51-20.3,4.51-9.76,0-21.5-1.78-21.5-1.78-12.94-3.09-23.25-9.23-26.46-14.39-2.01-3.22-4.35-6.47-5.93-10.61-1.58-4.14-3.17-8.88-4.75-14.22-.97-3.05-2.75-4.66-5.39-4.8-2.66.25-3.78,2.06-3.39,5.47.36,3.79.64,7.23.87,10.35s.41,6.23.64,9.35.38,6.27.49,9.48c.11,3.22.18,6.68.16,10.45,0,3.39,2,5.01,5.96,4.83,1.52-.1,3.15-.15,4.95-.16,1.8-.01,3.95.03,6.49.06,2.54.03,5.53.15,9.02.33l15.97,1.2,23.19,1.78c17.09,0,31.01-2.01,41.72-6.06,10.71-4.05,19.06-9.16,25.09-15.36,6.02-6.2,10.18-12.97,12.54-20.29,2.36-7.33,3.63-14.2,3.81-20.58.39-10.89-1.87-19.98-6.77-27.2-4.9-7.22-11.27-13.35-19.17-18.32Z"/>
        </g>
      </g>
      <g>
        <circle fill="#fff" cx="1302.98" cy="379.38" r="19.07"/>
        <circle fill="#fff" cx="1337.25" cy="345.08" r="14.28"/>
        <circle fill="#fff" cx="1365.45" cy="316.92" r="10.73"/>
        <circle fill="#fff" cx="1479.81" cy="122.91" r="19.07"/>
        <circle fill="#fff" cx="1445.51" cy="157.21" r="14.28"/>
        <circle fill="#fff" cx="1417.34" cy="185.38" r="10.73"/>
        <circle fill="#fff" cx="1238.22" cy="279.3" r="19.07"/>
        <circle fill="#fff" cx="1286.69" cy="279.3" r="14.28"/>
        <circle fill="#fff" cx="1326.55" cy="279.3" r="10.73"/>
        <circle fill="#fff" cx="1544.57" cy="223" r="19.07"/>
        <circle fill="#fff" cx="1496.09" cy="223" r="14.28"/>
        <circle fill="#fff" cx="1456.24" cy="223" r="10.73"/>
        <circle fill="#fff" cx="1263.16" cy="162.73" r="19.07"/>
        <circle fill="#fff" cx="1297.46" cy="197" r="14.28"/>
        <circle fill="#fff" cx="1325.62" cy="225.2" r="10.73"/>
        <circle fill="#fff" cx="1519.63" cy="339.56" r="19.07"/>
        <circle fill="#fff" cx="1485.33" cy="305.26" r="14.28"/>
        <circle fill="#fff" cx="1457.16" cy="277.09" r="10.73"/>
        <circle fill="#fff" cx="1363.24" cy="97.97" r="19.07"/>
        <circle fill="#fff" cx="1363.24" cy="146.45" r="14.28"/>
        <circle fill="#fff" cx="1363.24" cy="186.3" r="10.73"/>
        <circle fill="#fff" cx="1419.54" cy="404.32" r="19.07"/>
        <circle fill="#fff" cx="1419.54" cy="355.85" r="14.28"/>
        <circle fill="#fff" cx="1419.54" cy="315.99" r="10.73"/>
      </g>
    </g>
  </svg>
)

function useChart(id: string, config: () => object, deps: unknown[]) {
  const ref = useRef<any>(null)
  useEffect(() => {
    if (!(window as any).Chart) return
    const el = document.getElementById(id)
    if (!el) return
    ref.current?.destroy()
    ref.current = new (window as any).Chart(el, config())
    return () => { ref.current?.destroy() }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}

function exportCSV(data: any) {
  const rows: string[][] = []
  const sep = ";"
  const n = (v: number) => String(Math.round(v))
  const kr = (v: number) => String(Math.round(v)) + " kr"
  const pct = (a: number, b: number) => b > 0 ? Math.round(a/b*100)+"%" : "0%"
  const blank = () => rows.push(["","","","",""])
  rows.push(["VaekstNet Dashboard","","","",""])
  rows.push(["Exported", new Date().toLocaleString("da-DK"),"","",""])
  rows.push(["Last fetched from HubSpot", new Date(data.fetchedAt).toLocaleString("da-DK"),"","",""])
  blank()
  rows.push(["USER ACTIVATION · SINCE LAUNCH","","","",""])
  rows.push(["Metric","Count","Share of created","",""])
  rows.push(["Created users",   n(data.activation.created),   "100%","",""])
  rows.push(["Onboarded users",  n(data.activation.onboarded), pct(data.activation.onboarded, data.activation.created),"",""])
  rows.push(["Funded users",     n(data.activation.funded),    pct(data.activation.funded,    data.activation.created),"",""])
  rows.push(["Invested users", n(data.activation.invested),  pct(data.activation.invested,  data.activation.created),"",""])
  blank()
  rows.push(["FUND SUBSCRIPTION FUNNEL","","","",""])
  rows.push(["Under subscription", n(data.funnel.created), kr(data.funnel.pendingAmount),"",""])
  rows.push(["Signed",        n(data.funnel.signed),  kr(data.seller.vn.amount),"",""])
  rows.push(["Lost",          n(data.funnel.cancelled),"","",""])
  rows.push(["Conversion rate", pct(data.funnel.signed, data.funnel.signed+data.funnel.cancelled),"","",""])
  blank()
  rows.push(["ASSETS UNDER CUSTODY","","","",""])
  rows.push(["Total AuC",        kr(data.auc.total),   "100%","",""])
  rows.push(["of which VK funds", kr(data.auc.vkFunds), pct(data.auc.vkFunds, data.auc.total),"",""])
  rows.push(["of which listed",   kr(data.auc.listed),  pct(data.auc.listed,  data.auc.total),"",""])
  rows.push(["of which liquid",   kr(data.auc.cash),    pct(data.auc.cash,    data.auc.total),"",""])
  blank()
  rows.push(["TOP 10 CUSTOMERS · AuC","","","","","","",""])
  rows.push(["#","Name","Type","Contact owner","Total AuC","VK Funds","Listed","Liquid"])
  data.topCustomers?.forEach((c: any,i: number) => rows.push([String(i+1), c.name, c.type, c.consultant, kr(c.totalAuc), kr(c.vkFunds), kr(c.listed), kr(c.cash)]))
  blank()
  rows.push(["SELLER PERFORMANCE · DK · 2026 YTD","","","",""])
  rows.push(["Channel","Deals signed","Signed investment","Deals under signing","Expected"])
  rows.push(["Via Scrive DK",  n(data.seller.scriveDk.deals), kr(data.seller.scriveDk.amount), n(data.seller.scriveDk.pendingDeals), kr(data.seller.scriveDk.pendingAmount)])
  rows.push(["Via VaekstNet",  n(data.seller.vn.deals),       kr(data.seller.vn.amount),       n(data.seller.vn.pendingDeals),       kr(data.seller.vn.pendingAmount)])
  blank()
  rows.push(["SELLER · VIA SCRIVE DK","","","",""])
  rows.push(["#","Seller","Deals","Signed investment",""])
  data.seller.scriveSellers?.forEach((s: any,i: number) => rows.push([String(i+1), s.name, n(s.deals), kr(s.amount),"" ]))
  blank()
  rows.push(["SELLER · VIA VAEKSTNET","","","",""])
  rows.push(["#","Seller","Deals","Signed investment",""])
  data.seller.vnSellers?.forEach((s: any,i: number) => rows.push([String(i+1), s.name, n(s.deals), kr(s.amount),"" ]))
  blank()
  rows.push(["SIGNED PER FUND · VAEKSTNET","","","",""])
  rows.push(["#","Fund","Deals","Signed investment",""])
  data.funds?.forEach((f: any,i: number) => rows.push([String(i+1), f.name, n(f.deals), kr(f.amount),"" ]))
  blank()
  rows.push(["SIGNED PER FUND · SCRIVE DK","","","",""])
  rows.push(["#","Fund","Deals","Signed investment",""])
  data.seller.scriveFunds?.forEach((f: any,i: number) => rows.push([String(i+1), f.name, n(f.deals), kr(f.amount),"" ]))
  const csv = "\uFEFF" + rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(sep)).join("\n")
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url; a.download = `vaekstnet-dashboard-${new Date().toISOString().substring(0,10)}.csv`
  a.click(); URL.revokeObjectURL(url)
}

// ── Facebook Business Manager-style date range picker ─────────────────────────
const FB_PRESETS = [
  "Today","Yesterday","Today and yesterday",
  "Last 7 days","Last 14 days","Last 28 days","Last 30 days",
  "This week","Last week","This month","Last month",
]

function addMonths(d: Date, n: number) {
  const r = new Date(d)
  r.setDate(1)
  r.setMonth(r.getMonth() + n)
  return r
}
function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}
function isoDate(d: Date) {
  return d.toISOString().split("T")[0]
}
function presetToRange(preset: string): { start: string; end: string; label: string } {
  const now = new Date()
  const today = isoDate(now)
  const yest  = isoDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1))
  if (preset === "Today") return { start: today, end: today, label: "Today" }
  if (preset === "Yesterday") return { start: yest, end: yest, label: "Yesterday" }
  if (preset === "Today and yesterday") return { start: yest, end: today, label: "Today and yesterday" }
  if (preset === "Last 7 days") { const s = isoDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6)); return { start: s, end: today, label: "Last 7 days" } }
  if (preset === "Last 14 days") { const s = isoDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 13)); return { start: s, end: today, label: "Last 14 days" } }
  if (preset === "Last 28 days") { const s = isoDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 27)); return { start: s, end: today, label: "Last 28 days" } }
  if (preset === "Last 30 days") { const s = isoDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29)); return { start: s, end: today, label: "Last 30 days" } }
  if (preset === "This week") { const d = now.getDay(); const s = isoDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - (d === 0 ? 6 : d - 1))); return { start: s, end: today, label: "This week" } }
  if (preset === "Last week") { const d = now.getDay(); const e = isoDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - (d === 0 ? 7 : d))); const s = isoDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - (d === 0 ? 13 : d + 6))); return { start: s, end: e, label: "Last week" } }
  if (preset === "This month") { const s = isoDate(new Date(now.getFullYear(), now.getMonth(), 1)); return { start: s, end: today, label: "This month" } }
  if (preset === "Last month") { const s = isoDate(new Date(now.getFullYear(), now.getMonth() - 1, 1)); const e = isoDate(new Date(now.getFullYear(), now.getMonth(), 0)); return { start: s, end: e, label: "Last month" } }
  return { start: today, end: today, label: preset }
}

function FBDatePicker({ onApply, onClose }: { onApply: (label: string, start: string, end: string) => void; onClose: () => void }) {
  const now = new Date()
  const [leftMonth, setLeftMonth] = React.useState(new Date(now.getFullYear(), now.getMonth() - 1, 1))
  const [activePreset, setActivePreset] = React.useState("Last 30 days")
  const [rangeStart, setRangeStart] = React.useState(() => presetToRange("Last 30 days").start)
  const [rangeEnd, setRangeEnd] = React.useState(() => presetToRange("Last 30 days").end)
  const [hovered, setHovered] = React.useState<string|null>(null)
  const [compareOn, setCompareOn] = React.useState(false)
  const [customStart, setCustomStart] = React.useState("")
  const [customEnd, setCustomEnd] = React.useState("")

  const rightMonth = addMonths(leftMonth, 1)

  function selectPreset(p: string) {
    setActivePreset(p)
    const r = presetToRange(p)
    setRangeStart(r.start); setRangeEnd(r.end)
    setCustomStart(""); setCustomEnd("")
  }

  function handleDayClick(ds: string) {
    setActivePreset("")
    if (!rangeStart || (rangeStart && rangeEnd)) {
      setRangeStart(ds); setRangeEnd("")
    } else {
      if (ds < rangeStart) { setRangeEnd(rangeStart); setRangeStart(ds) }
      else { setRangeEnd(ds) }
    }
  }

  function inRange(ds: string) {
    const end = rangeEnd || hovered || ""
    if (!rangeStart) return false
    const lo = rangeStart < end ? rangeStart : end
    const hi = rangeStart < end ? end : rangeStart
    return ds >= lo && ds <= hi
  }

  function CalendarMonth({ base }: { base: Date }) {
    const year = base.getFullYear(), month = base.getMonth()
    const DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"]
    const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"]
    const firstDay = new Date(year, month, 1).getDay()
    const total = daysInMonth(year, month)
    const cells: (number|null)[] = Array(firstDay).fill(null)
    for (let d = 1; d <= total; d++) cells.push(d)
    while (cells.length % 7 !== 0) cells.push(null)

    const YEARS = Array.from({length: 10}, (_,i) => now.getFullYear() - 4 + i)

    return (
      <div style={{width:220}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
          <select value={MONTHS[month]} onChange={e=>{const m=MONTHS.indexOf(e.target.value);setLeftMonth(new Date(year,base===leftMonth?m:m-1,1))}}
            style={{fontSize:13,fontWeight:700,border:"none",background:"transparent",cursor:"pointer",fontFamily:"inherit",color:"#1c1e21",padding:"2px 4px"}}>
            {MONTHS.map(m=><option key={m}>{m}</option>)}
          </select>
          <select value={year} onChange={e=>{const y=Number(e.target.value);setLeftMonth(new Date(y,base===leftMonth?month:month-1,1))}}
            style={{fontSize:13,fontWeight:700,border:"none",background:"transparent",cursor:"pointer",fontFamily:"inherit",color:"#1c1e21",padding:"2px 4px"}}>
            {YEARS.map(y=><option key={y}>{y}</option>)}
          </select>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:1,marginBottom:4}}>
          {DAYS.map(d=><div key={d} style={{textAlign:"center",fontSize:11,color:"#65676b",fontWeight:600,padding:"4px 0"}}>{d}</div>)}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:1}}>
          {cells.map((d,i)=>{
            if (!d) return <div key={i}/>
            const ds = `${year}-${String(month+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`
            const isStart = ds===rangeStart, isEnd = ds===rangeEnd || (!rangeEnd&&ds===hovered&&ds!==rangeStart)
            const inR = inRange(ds)
            const bg = isStart||isEnd?"#1877f2":inR?"#e7f0fd":"transparent"
            const col = isStart||isEnd?"#fff":inR?"#1877f2":"#1c1e21"
            return (
              <div key={i} onClick={()=>handleDayClick(ds)} onMouseEnter={()=>setHovered(ds)} onMouseLeave={()=>setHovered(null)}
                style={{textAlign:"center",fontSize:13,padding:"5px 2px",borderRadius:4,background:bg,color:col,cursor:"pointer",userSelect:"none",fontWeight:isStart||isEnd?700:400}}>
                {d}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  const displayLabel = activePreset || (rangeStart && rangeEnd ? `${rangeStart} – ${rangeEnd}` : rangeStart || "Select dates")
  const applyLabel = activePreset || (rangeStart && rangeEnd ? `${rangeStart} – ${rangeEnd}` : rangeStart || "")

  return (
    <div style={{position:"fixed" as const,inset:0,zIndex:9999,display:"flex",alignItems:"flex-start",justifyContent:"center",paddingTop:80}} onClick={e=>{if(e.target===e.currentTarget)onClose()}}>
      <div style={{background:"#fff",borderRadius:8,boxShadow:"0 8px 32px rgba(0,0,0,.2)",display:"flex",overflow:"hidden",minWidth:680,maxWidth:860}}>
        {/* Left: presets */}
        <div style={{width:180,borderRight:"1px solid #e4e6ea",padding:"16px 0"}}>
          <div style={{fontSize:11,fontWeight:700,color:"#65676b",letterSpacing:".07em",textTransform:"uppercase" as const,padding:"0 16px 10px"}}>Recently used</div>
          {FB_PRESETS.map(p=>(
            <div key={p} onClick={()=>selectPreset(p)}
              style={{padding:"8px 16px",fontSize:13,cursor:"pointer",color:activePreset===p?"#1877f2":"#1c1e21",fontWeight:activePreset===p?600:400,background:activePreset===p?"#e7f0fd":"transparent"}}>
              {p}
            </div>
          ))}
        </div>
        {/* Right: calendars + controls */}
        <div style={{flex:1,padding:"16px 20px"}}>
          <div style={{display:"flex",gap:24,marginBottom:16}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:0}}>
              <button onClick={()=>setLeftMonth(addMonths(leftMonth,-1))} style={{border:"none",background:"none",cursor:"pointer",fontSize:16,color:"#65676b",padding:"2px 6px",borderRadius:4}}>‹</button>
              <CalendarMonth base={leftMonth}/>
              <div style={{width:1,background:"#e4e6ea",alignSelf:"stretch"}}/>
              <CalendarMonth base={rightMonth}/>
              <button onClick={()=>setLeftMonth(addMonths(leftMonth,1))} style={{border:"none",background:"none",cursor:"pointer",fontSize:16,color:"#65676b",padding:"2px 6px",borderRadius:4}}>›</button>
            </div>
          </div>
          {/* Compare */}
          <div style={{borderTop:"1px solid #e4e6ea",paddingTop:12,marginBottom:12}}>
            <label style={{display:"flex",alignItems:"center",gap:8,fontSize:13,cursor:"pointer",userSelect:"none" as const,color:"#1c1e21",fontWeight:500}}>
              <input type="checkbox" checked={compareOn} onChange={e=>setCompareOn(e.target.checked)} style={{accentColor:"#1877f2",width:14,height:14}}/>
              Compare
            </label>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12,fontSize:12,color:"#65676b"}}>
            <select defaultValue="Custom" style={{fontSize:12,border:"1px solid #ccd0d5",borderRadius:4,padding:"4px 8px",fontFamily:"inherit",color:"#1c1e21",background:"#fff"}}>
              <option>Custom</option><option>Previous period</option><option>Previous year</option>
            </select>
            <span style={{color:"#1877f2",fontWeight:500}}>{rangeStart ? new Date(rangeStart+"T00:00:00").toLocaleDateString("en-GB",{day:"numeric",month:"long",year:"numeric"}) : "–"}</span>
            <span>–</span>
            <span style={{color:"#1877f2",fontWeight:500}}>{(rangeEnd||rangeStart) ? new Date((rangeEnd||rangeStart)+"T00:00:00").toLocaleDateString("en-GB",{day:"numeric",month:"long",year:"numeric"}) : "–"}</span>
          </div>
          <div style={{fontSize:11,color:"#65676b",marginBottom:14}}>Dates are shown in Copenhagen Time</div>
          <div style={{display:"flex",justifyContent:"flex-end",gap:8}}>
            <button onClick={onClose} style={{padding:"7px 18px",fontSize:13,border:"1px solid #ccd0d5",borderRadius:6,background:"#fff",color:"#1c1e21",cursor:"pointer",fontFamily:"inherit",fontWeight:500}}>Cancel</button>
            <button onClick={()=>onApply(applyLabel, rangeStart, rangeEnd||rangeStart)}
              style={{padding:"7px 18px",fontSize:13,fontWeight:600,border:"none",borderRadius:6,background:"#1877f2",color:"#fff",cursor:"pointer",fontFamily:"inherit"}}>Update</button>
          </div>
        </div>
      </div>
    </div>
  )
}

function DashboardInner() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [data, setData] = useState<any>(null)
  const [openDeals, setOpenDeals] = useState<any>(null)
  const [error, setError] = useState<string>("")
  const [syncing, setSyncing] = useState<boolean>(false)
  const [chartReady, setChartReady] = useState<boolean>(false)
  const [expandedScrive, setExpandedScrive] = useState<string|null>(null)
  const [expandedVn, setExpandedVn] = useState<string|null>(null)
  const [expandedFundSigned, setExpandedFundSigned] = useState<string|null>(null)
  const [expandedFundPending, setExpandedFundPending] = useState<string|null>(null)
  const [expandedScriveFund, setExpandedScriveFund] = useState<string|null>(null)
  const [expandedScriveFundDate, setExpandedScriveFundDate] = useState<string|null>(null)
  const [expandedVnFundDate, setExpandedVnFundDate] = useState<string|null>(null)
  const [tab, setTab] = useState<"deals"|"contact-pipeline">("deals")
  const [pipelineData, setPipelineData] = useState<any>(null)
  const [pipelineLoading, setPipelineLoading] = useState(false)
  const searchParams = useSearchParams()
  const [region, setRegion] = useState<"dk"|"se"|"ship"|"at"|"fi"|"no"|"compass">(() => {
    if (typeof window === "undefined") return "dk"
    const p = new URLSearchParams(window.location.search).get("region")
    return (["dk","se","ship","at","fi","no","compass"].includes(p ?? "") ? p : "dk") as "dk"|"se"|"ship"|"at"|"fi"|"no"|"compass"
  })
  // Sync region state on client-side navigation (same route, different ?region=)
  useEffect(() => {
    const p = searchParams.get("region") ?? "dk"
    const next = (["dk","se","ship","at","fi","no","compass"].includes(p) ? p : "dk") as typeof region
    if (next !== region) setRegion(next)
  }, [searchParams])
  const [pipelineModal, setPipelineModal] = useState<{title: string, deals: any[], fmtAmt?: (n: number) => string} | null>(null)
  // YTD defaults — Jan 1 of current year → today
  const _ytdFrom = `${new Date().getFullYear()}-01-01`
  const _ytdTo   = new Date().toISOString().split("T")[0]
  // SE Sweden state
  const [seClosedDeals, setSeClosedDeals] = useState<any>(null)
  const [seOpenDeals, setSeOpenDeals] = useState<any>(null)
  const [seC1From, setSeC1From] = useState<string>(_ytdFrom)
  const [seC1To, setSeC1To]     = useState<string>(_ytdTo)
  const [seC1Stage, setSeC1Stage]       = useState<string>("")
  const [seC1Pipeline, setSeC1Pipeline] = useState<string>("")
  const [seC1Owner, setSeC1Owner]       = useState<string>("")
  const [seClosedDealsLoading, setSeClosedDealsLoading] = useState<boolean>(false)
  const [seDealsTriggered, setSeDealsTriggered] = useState<boolean>(false)
  const seClosedTimerRef = useRef<any>(null)
  const [seFundDateFrom, setSeFundDateFrom] = useState<string>("")
  const [seFundDateTo, setSeFundDateTo]     = useState<string>("")
  const [seFundDateDeals, setSeFundDateDeals] = useState<any>(null)
  const [seFundDateLoading, setSeFundDateLoading] = useState<boolean>(false)
  const seFundTimerRef = useRef<any>(null)
  const [seExpandedFund, setSeExpandedFund] = useState<string|null>(null)
  // Ship (Shipping) state
  const [shipClosedDeals, setShipClosedDeals] = useState<any>(null)
  const [shipOpenDeals, setShipOpenDeals] = useState<any>(null)
  const [shipC1From, setShipC1From] = useState<string>(_ytdFrom)
  const [shipC1To, setShipC1To]     = useState<string>(_ytdTo)
  const [shipC1Stage, setShipC1Stage]       = useState<string>("")
  const [shipC1Pipeline, setShipC1Pipeline] = useState<string>("")
  const [shipC1Owner, setShipC1Owner]       = useState<string>("")
  const [shipClosedDealsLoading, setShipClosedDealsLoading] = useState<boolean>(false)
  const [shipDealsTriggered, setShipDealsTriggered] = useState<boolean>(false)
  const shipClosedTimerRef = useRef<any>(null)
  const [shipFundDateFrom, setShipFundDateFrom] = useState<string>("")
  const [shipFundDateTo, setShipFundDateTo]     = useState<string>("")
  const [shipFundDateDeals, setShipFundDateDeals] = useState<any>(null)
  const [shipFundDateLoading, setShipFundDateLoading] = useState<boolean>(false)
  const shipFundTimerRef = useRef<any>(null)
  const [shipExpandedFund, setShipExpandedFund] = useState<string|null>(null)
  // AT (Austria) state
  const [atClosedDeals, setAtClosedDeals] = useState<any>(null)
  const [atOpenDeals, setAtOpenDeals] = useState<any>(null)
  const [atC1From, setAtC1From] = useState<string>(_ytdFrom)
  const [atC1To, setAtC1To]     = useState<string>(_ytdTo)
  const [atC1Stage, setAtC1Stage]       = useState<string>("")
  const [atC1Pipeline, setAtC1Pipeline] = useState<string>("")
  const [atC1Owner, setAtC1Owner]       = useState<string>("")
  const [atClosedDealsLoading, setAtClosedDealsLoading] = useState<boolean>(false)
  const [atDealsTriggered, setAtDealsTriggered] = useState<boolean>(false)
  const atClosedTimerRef = useRef<any>(null)
  const [atFundDateFrom, setAtFundDateFrom] = useState<string>("")
  const [atFundDateTo, setAtFundDateTo]     = useState<string>("")
  const [atFundDateDeals, setAtFundDateDeals] = useState<any>(null)
  const [atFundDateLoading, setAtFundDateLoading] = useState<boolean>(false)
  const atFundTimerRef = useRef<any>(null)
  const [atExpandedFund, setAtExpandedFund] = useState<string|null>(null)
  // FI (Finland) state
  const [fiClosedDeals, setFiClosedDeals] = useState<any>(null)
  const [fiOpenDeals, setFiOpenDeals] = useState<any>(null)
  const [fiC1From, setFiC1From] = useState<string>(_ytdFrom)
  const [fiC1To, setFiC1To]     = useState<string>(_ytdTo)
  const [fiC1Stage, setFiC1Stage]       = useState<string>("")
  const [fiC1Pipeline, setFiC1Pipeline] = useState<string>("")
  const [fiC1Owner, setFiC1Owner]       = useState<string>("")
  const [fiClosedDealsLoading, setFiClosedDealsLoading] = useState<boolean>(false)
  const [fiDealsTriggered, setFiDealsTriggered] = useState<boolean>(false)
  const fiClosedTimerRef = useRef<any>(null)
  const [fiFundDateFrom, setFiFundDateFrom] = useState<string>("")
  const [fiFundDateTo, setFiFundDateTo]     = useState<string>("")
  const [fiFundDateDeals, setFiFundDateDeals] = useState<any>(null)
  const [fiFundDateLoading, setFiFundDateLoading] = useState<boolean>(false)
  const fiFundTimerRef = useRef<any>(null)
  const [fiExpandedFund, setFiExpandedFund] = useState<string|null>(null)
  // NO (Norway) state
  const [noClosedDeals, setNoClosedDeals] = useState<any>(null)
  const [noOpenDeals, setNoOpenDeals] = useState<any>(null)
  const [noC1From, setNoC1From] = useState<string>(_ytdFrom)
  const [noC1To, setNoC1To]     = useState<string>(_ytdTo)
  const [noC1Stage, setNoC1Stage]       = useState<string>("")
  const [noC1Pipeline, setNoC1Pipeline] = useState<string>("")
  const [noC1Owner, setNoC1Owner]       = useState<string>("")
  const [noClosedDealsLoading, setNoClosedDealsLoading] = useState<boolean>(false)
  const [noDealsTriggered, setNoDealsTriggered] = useState<boolean>(false)
  const noClosedTimerRef = useRef<any>(null)
  const [noFundDateFrom, setNoFundDateFrom] = useState<string>("")
  const [noFundDateTo, setNoFundDateTo]     = useState<string>("")
  const [noFundDateDeals, setNoFundDateDeals] = useState<any>(null)
  const [noFundDateLoading, setNoFundDateLoading] = useState<boolean>(false)
  const noFundTimerRef = useRef<any>(null)
  const [noExpandedFund, setNoExpandedFund] = useState<string|null>(null)
  // Compass.Vaekstnet state
  const [compassData, setCompassData] = useState<any>(null)
  const [compassLoading, setCompassLoading] = useState<boolean>(false)
  const [compassPersonFilter, setCompassPersonFilter] = useState<string>("")
  // Period picker: YYYY-MM strings
  const _toDateStr = (d: Date) => d.toISOString().slice(0,10)
  const _monthStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1)
  const _prevMonthStart = () => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth()-1, 1) }
  const _prevMonthEnd   = () => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), 0) }
  const [compassFrom, setCompassFrom] = useState<string>(() => _toDateStr(_monthStart(new Date())))
  const [compassTo,   setCompassTo]   = useState<string>(() => _toDateStr(new Date()))
  const [compassCompareOn,   setCompassCompareOn]   = useState<boolean>(false)
  const [compassCompareFrom, setCompassCompareFrom] = useState<string>(() => _toDateStr(_prevMonthStart()))
  const [compassCompareTo,   setCompassCompareTo]   = useState<string>(() => _toDateStr(_prevMonthEnd()))
  const [compassPickerOpen, setCompassPickerOpen] = useState<boolean>(false)
  const [compassSubTab, setCompassSubTab] = useState<string>("investment")
  const [compassOverviewSection, setCompassOverviewSection] = useState<string>("vaekstkapital")
  const [expandedConsultant, setExpandedConsultant] = useState<string|null>(null)
  const [compassMonth, setCompassMonth] = useState<string>(()=>{const n=new Date();return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,"0")}`})
  const [compassConsultantsOpen, setCompassConsultantsOpen] = useState<boolean>(false)
  const [compassManagersOpen, setCompassManagersOpen] = useState<boolean>(false)
  const [investPickerOpen, setInvestPickerOpen] = useState<boolean>(false)
  const [investDateLabel, setInvestDateLabel] = useState<string>("This month")
  const [consOutcomesPickerOpen, setConsOutcomesPickerOpen] = useState<boolean>(false)
  const [consOutcomesLabel, setConsOutcomesLabel] = useState<string>("This month")
  const [mgrMeetingPickerOpen, setMgrMeetingPickerOpen] = useState<boolean>(false)
  const [mgrMeetingLabel, setMgrMeetingLabel] = useState<string>("This month")
  // Section 1 — Deals Closed (filters by close date)
  const [c1From, setC1From]         = useState<string>(_ytdFrom)
  const [c1To, setC1To]             = useState<string>(_ytdTo)
  const [c1Stage, setC1Stage]       = useState<string>("")
  const [c1Status, setC1Status]     = useState<string>("")
  const [c1Pipeline, setC1Pipeline] = useState<string>("")
  const [c1Owner, setC1Owner]       = useState<string>("")
  const [closedDeals, setClosedDeals]           = useState<any>(null)
  const [closedDealsLoading, setClosedDealsLoading] = useState<boolean>(false)
  const closedDealsTimerRef = useRef<any>(null)
  const [fundDateFrom, setFundDateFrom] = useState<string>("")
  const [fundDateTo, setFundDateTo]     = useState<string>("")
  const [fundDateDeals, setFundDateDeals] = useState<any>(null)
  const [fundDateLoading, setFundDateLoading] = useState<boolean>(false)
  // Closed Deals report — filtered by close date
  const [prFrom, setPrFrom] = useState<string>("")
  const [prTo, setPrTo]     = useState<string>("")
  const [prDeals, setPrDeals] = useState<any>(null)
  const [prLoading, setPrLoading] = useState<boolean>(false)
  const prTimerRef = useRef<any>(null)
  // Pipeline Activity report — filtered by create date (in-memory)
  const [paFrom, setPaFrom] = useState<string>("")
  const [paTo, setPaTo]     = useState<string>("")
  const fundDateTimerRef = useRef<any>(null)

  useEffect(() => { if (status === "unauthenticated") router.push("/login") }, [status, router])
  useEffect(() => {
    const s = document.createElement("script")
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js"
    s.onload = () => setChartReady(true)
    document.head.appendChild(s)
  }, [])
  useEffect(() => {
    if (status !== "authenticated") return
    // /api/open-deals is Denmark-scoped and now returns 403 for non-DK users,
    // so only ask for it when this user may actually read Denmark. /api/data is
    // group-level VaekstNet KPIs and stays available to everyone signed in.
    const mayReadDk = canReadRegion(resolveAccess(session?.user?.email), "dk")
    Promise.all([
      fetch("/api/data").then(r => r.json()),
      mayReadDk ? fetch("/api/open-deals").then(r => r.json()) : Promise.resolve({ error: "forbidden" }),
    ]).then(([d, od]) => {
      if (d.error) setError(d.error); else setData(d)
      if (!od.error) setOpenDeals(od)
    }).catch(() => setError("Kunne ikke hente data"))
  }, [status, session])

  // Load pipeline data on mount (pipeline is default tab)
  useEffect(() => {
    if (status !== "authenticated" || pipelineData || pipelineLoading) return
    setPipelineLoading(true)
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 6000)
    fetch("/api/pipeline-data", { signal: ctrl.signal })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d && !d.error) setPipelineData(d) })
      .catch(() => {})
      .finally(() => { clearTimeout(timer); setPipelineLoading(false) })
  }, [status])

  useEffect(() => {
    if (status !== "authenticated") return
    // Denmark-scoped endpoint — skip for users the server would 403.
    if (!canReadRegion(resolveAccess(session?.user?.email), "dk")) return
    const ytdFrom = `${new Date().getFullYear()}-01-01`
    const ytdTo   = new Date().toISOString().split("T")[0]
    const from = c1From || ytdFrom
    const to   = c1To   || ytdTo
    setClosedDealsLoading(true)
    clearTimeout(closedDealsTimerRef.current)
    // no debounce on initial load; debounce only when user is typing dates
    const delay = (c1From === _ytdFrom && c1To === _ytdTo) ? 0 : 800
    closedDealsTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/closed-deals?from=${from}&to=${to}`)
        const d = await res.json()
        if (!d.error) setClosedDeals(d)
      } catch {}
      setClosedDealsLoading(false)
    }, delay)
    return () => clearTimeout(closedDealsTimerRef.current)
  }, [status, c1From, c1To])

  useEffect(() => {
    if (!(fundDateFrom || fundDateTo)) { setFundDateDeals(null); return }
    setFundDateLoading(true)
    clearTimeout(fundDateTimerRef.current)
    fundDateTimerRef.current = setTimeout(async () => {
      try {
        const params = new URLSearchParams()
        if (fundDateFrom) params.set("from", fundDateFrom)
        if (fundDateTo)   params.set("to", fundDateTo)
        const res = await fetch(`/api/closed-deals?${params}`)
        const d = await res.json()
        if (!d.error) setFundDateDeals(d)
      } catch {}
      setFundDateLoading(false)
    }, 800)
    return () => clearTimeout(fundDateTimerRef.current)
  }, [fundDateFrom, fundDateTo])

  // Pipeline Report date-filtered clone
  useEffect(() => {
    if (!(prFrom || prTo)) { setPrDeals(null); return }
    setPrLoading(true)
    clearTimeout(prTimerRef.current)
    prTimerRef.current = setTimeout(async () => {
      try {
        const params = new URLSearchParams()
        if (prFrom) params.set("from", prFrom)
        if (prTo)   params.set("to",   prTo)
        const res = await fetch(`/api/closed-deals?${params}`)
        const d = await res.json()
        if (!d.error) setPrDeals(d)
      } catch {}
      setPrLoading(false)
    }, 800)
    return () => clearTimeout(prTimerRef.current)
  }, [prFrom, prTo])

  // Auto-select region based on access permissions.
  // Rules come from src/lib/access.ts — the same module the API guards use, so
  // the UI can never offer a region the server would reject with a 403.
  useEffect(() => {
    if (status !== "authenticated") return
    const allowed = resolveAccess(session?.user?.email).regions
    if (allowed.length === 0) return
    // Compass is admin-only; admins keep whatever region they're on.
    if (region === "compass") return
    // Admins keep whatever ?region= put them on; scoped users land on theirs.
    if (!allowed.includes(region as any)) setRegion(allowed[0] as typeof region)
  }, [status, session, region])

  // SE closed deals (live, date-filtered)
  useEffect(() => {
    if (status !== "authenticated" || region !== "se" || !seDealsTriggered) return
    const ytdFrom = `${new Date().getFullYear()}-01-01`
    const ytdTo   = new Date().toISOString().split("T")[0]
    const from = seC1From || ytdFrom
    const to   = seC1To   || ytdTo
    setSeClosedDealsLoading(true)
    clearTimeout(seClosedTimerRef.current)
    const delay = (seC1From === _ytdFrom && seC1To === _ytdTo) ? 0 : 800
    seClosedTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/se-closed-deals?from=${from}&to=${to}`)
        const d = await res.json()
        if (!d.error) setSeClosedDeals(d)
      } catch {}
      setSeClosedDealsLoading(false)
    }, delay)
    return () => clearTimeout(seClosedTimerRef.current)
  }, [status, region, seC1From, seC1To, seDealsTriggered])

  // SE open deals (pipeline report)
  useEffect(() => {
    if (status !== "authenticated" || region !== "se") return
    fetch("/api/se-open-deals").then(r => r.json()).then(d => {
      if (!d.error) setSeOpenDeals(d)
    }).catch(() => {})
  }, [status, region])

  // SE fund date filter
  useEffect(() => {
    if (!(seFundDateFrom || seFundDateTo)) { setSeFundDateDeals(null); return }
    setSeFundDateLoading(true)
    clearTimeout(seFundTimerRef.current)
    seFundTimerRef.current = setTimeout(async () => {
      try {
        const params = new URLSearchParams()
        if (seFundDateFrom) params.set("from", seFundDateFrom)
        if (seFundDateTo)   params.set("to", seFundDateTo)
        const res = await fetch(`/api/se-closed-deals?${params}`)
        const d = await res.json()
        if (!d.error) setSeFundDateDeals(d)
      } catch {}
      setSeFundDateLoading(false)
    }, 800)
    return () => clearTimeout(seFundTimerRef.current)
  }, [seFundDateFrom, seFundDateTo])

  // Ship closed deals
  useEffect(() => {
    if (status !== "authenticated" || region !== "ship" || !shipDealsTriggered) return
    const ytdFrom = `${new Date().getFullYear()}-01-01`
    const ytdTo   = new Date().toISOString().split("T")[0]
    const from = shipC1From || ytdFrom
    const to   = shipC1To   || ytdTo
    setShipClosedDealsLoading(true)
    clearTimeout(shipClosedTimerRef.current)
    const delay = (shipC1From === _ytdFrom && shipC1To === _ytdTo) ? 0 : 800
    shipClosedTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/ship-closed-deals?from=${from}&to=${to}`)
        const d = await res.json()
        if (!d.error) setShipClosedDeals(d)
      } catch {}
      setShipClosedDealsLoading(false)
    }, delay)
    return () => clearTimeout(shipClosedTimerRef.current)
  }, [status, region, shipC1From, shipC1To, shipDealsTriggered])

  // Ship open deals
  useEffect(() => {
    if (status !== "authenticated" || region !== "ship") return
    fetch("/api/ship-open-deals").then(r => r.json()).then(d => {
      if (!d.error) setShipOpenDeals(d)
    }).catch(() => {})
  }, [status, region])

  // Ship fund date filter
  useEffect(() => {
    if (!(shipFundDateFrom || shipFundDateTo)) { setShipFundDateDeals(null); return }
    setShipFundDateLoading(true)
    clearTimeout(shipFundTimerRef.current)
    shipFundTimerRef.current = setTimeout(async () => {
      try {
        const params = new URLSearchParams()
        if (shipFundDateFrom) params.set("from", shipFundDateFrom)
        if (shipFundDateTo)   params.set("to", shipFundDateTo)
        const res = await fetch(`/api/ship-closed-deals?${params}`)
        const d = await res.json()
        if (!d.error) setShipFundDateDeals(d)
      } catch {}
      setShipFundDateLoading(false)
    }, 800)
    return () => clearTimeout(shipFundTimerRef.current)
  }, [shipFundDateFrom, shipFundDateTo])

  // AT closed deals
  useEffect(() => {
    if (status !== "authenticated" || region !== "at" || !atDealsTriggered) return
    const ytdFrom = `${new Date().getFullYear()}-01-01`
    const ytdTo   = new Date().toISOString().split("T")[0]
    const from = atC1From || ytdFrom
    const to   = atC1To   || ytdTo
    setAtClosedDealsLoading(true)
    clearTimeout(atClosedTimerRef.current)
    const delay = (atC1From === _ytdFrom && atC1To === _ytdTo) ? 0 : 800
    atClosedTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/at-closed-deals?from=${from}&to=${to}`)
        const d = await res.json()
        if (!d.error) setAtClosedDeals(d)
      } catch {}
      setAtClosedDealsLoading(false)
    }, delay)
    return () => clearTimeout(atClosedTimerRef.current)
  }, [status, region, atC1From, atC1To, atDealsTriggered])

  // AT open deals
  useEffect(() => {
    if (status !== "authenticated" || region !== "at") return
    fetch("/api/at-open-deals").then(r => r.json()).then(d => {
      if (!d.error) setAtOpenDeals(d)
    }).catch(() => {})
  }, [status, region])

  // AT fund date filter
  useEffect(() => {
    if (!(atFundDateFrom || atFundDateTo)) { setAtFundDateDeals(null); return }
    setAtFundDateLoading(true)
    clearTimeout(atFundTimerRef.current)
    atFundTimerRef.current = setTimeout(async () => {
      try {
        const params = new URLSearchParams()
        if (atFundDateFrom) params.set("from", atFundDateFrom)
        if (atFundDateTo)   params.set("to", atFundDateTo)
        const res = await fetch(`/api/at-closed-deals?${params}`)
        const d = await res.json()
        if (!d.error) setAtFundDateDeals(d)
      } catch {}
      setAtFundDateLoading(false)
    }, 800)
    return () => clearTimeout(atFundTimerRef.current)
  }, [atFundDateFrom, atFundDateTo])

  // FI closed deals
  useEffect(() => {
    if (status !== "authenticated" || region !== "fi" || !fiDealsTriggered) return
    const ytdFrom = `${new Date().getFullYear()}-01-01`
    const ytdTo   = new Date().toISOString().split("T")[0]
    const from = fiC1From || ytdFrom
    const to   = fiC1To   || ytdTo
    setFiClosedDealsLoading(true)
    clearTimeout(fiClosedTimerRef.current)
    const delay = (fiC1From === _ytdFrom && fiC1To === _ytdTo) ? 0 : 800
    fiClosedTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/fi-closed-deals?from=${from}&to=${to}`)
        const d = await res.json()
        if (!d.error) setFiClosedDeals(d)
      } catch {}
      setFiClosedDealsLoading(false)
    }, delay)
    return () => clearTimeout(fiClosedTimerRef.current)
  }, [status, region, fiC1From, fiC1To, fiDealsTriggered])

  // FI open deals
  useEffect(() => {
    if (status !== "authenticated" || region !== "fi") return
    fetch("/api/fi-open-deals").then(r => r.json()).then(d => {
      if (!d.error) setFiOpenDeals(d)
    }).catch(() => {})
  }, [status, region])

  // FI fund date filter
  useEffect(() => {
    if (!(fiFundDateFrom || fiFundDateTo)) { setFiFundDateDeals(null); return }
    setFiFundDateLoading(true)
    clearTimeout(fiFundTimerRef.current)
    fiFundTimerRef.current = setTimeout(async () => {
      try {
        const params = new URLSearchParams()
        if (fiFundDateFrom) params.set("from", fiFundDateFrom)
        if (fiFundDateTo)   params.set("to", fiFundDateTo)
        const res = await fetch(`/api/fi-closed-deals?${params}`)
        const d = await res.json()
        if (!d.error) setFiFundDateDeals(d)
      } catch {}
      setFiFundDateLoading(false)
    }, 800)
    return () => clearTimeout(fiFundTimerRef.current)
  }, [fiFundDateFrom, fiFundDateTo])

  // NO closed deals
  useEffect(() => {
    if (status !== "authenticated" || region !== "no" || !noDealsTriggered) return
    const ytdFrom = `${new Date().getFullYear()}-01-01`
    const ytdTo   = new Date().toISOString().split("T")[0]
    const from = noC1From || ytdFrom
    const to   = noC1To   || ytdTo
    setNoClosedDealsLoading(true)
    clearTimeout(noClosedTimerRef.current)
    const delay = (noC1From === _ytdFrom && noC1To === _ytdTo) ? 0 : 800
    noClosedTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/no-closed-deals?from=${from}&to=${to}`)
        const d = await res.json()
        if (!d.error) setNoClosedDeals(d)
      } catch {}
      setNoClosedDealsLoading(false)
    }, delay)
    return () => clearTimeout(noClosedTimerRef.current)
  }, [status, region, noC1From, noC1To, noDealsTriggered])

  // NO open deals
  useEffect(() => {
    if (status !== "authenticated" || region !== "no") return
    fetch("/api/no-open-deals").then(r => r.json()).then(d => {
      if (!d.error) setNoOpenDeals(d)
    }).catch(() => {})
  }, [status, region])

  // NO fund date filter
  useEffect(() => {
    if (!(noFundDateFrom || noFundDateTo)) { setNoFundDateDeals(null); return }
    setNoFundDateLoading(true)
    clearTimeout(noFundTimerRef.current)
    noFundTimerRef.current = setTimeout(async () => {
      try {
        const params = new URLSearchParams()
        if (noFundDateFrom) params.set("from", noFundDateFrom)
        if (noFundDateTo)   params.set("to", noFundDateTo)
        const res = await fetch(`/api/no-closed-deals?${params}`)
        const d = await res.json()
        if (!d.error) setNoFundDateDeals(d)
      } catch {}
      setNoFundDateLoading(false)
    }, 800)
    return () => clearTimeout(noFundTimerRef.current)
  }, [noFundDateFrom, noFundDateTo])

  // Compass data fetch — called on first load and when user applies new period
  const fetchCompass = (from: string, to: string, compareOn: boolean, cFrom: string, cTo: string) => {
    setCompassLoading(true)
    setCompassData(null)
    let url = `/api/compass?from=${from}&to=${to}`
    if (compareOn) url += `&compareFrom=${cFrom}&compareTo=${cTo}`
    fetch(url).then(r => r.json()).then(d => {
      if (!d.error) setCompassData(d)
      setCompassLoading(false)
    }).catch(() => setCompassLoading(false))
  }

  useEffect(() => {
    if (status !== "authenticated" || region !== "compass" || compassData || compassLoading) return
    fetchCompass(compassFrom, compassTo, compassCompareOn, compassCompareFrom, compassCompareTo)
  }, [status, region])

  async function triggerSync() {
    setSyncing(true)
    try {
      const syncRes = await fetch("/api/sync")
      const syncJson = await syncRes.json()
      if (!syncRes.ok || syncJson.error) {
        alert(`Sync failed: ${syncJson.error || syncRes.statusText}`)
        setSyncing(false)
        return
      }
      const [d, od] = await Promise.all([
        fetch("/api/data").then(r => r.json()),
        fetch("/api/open-deals").then(r => r.json()),
      ])
      if (!d.error) setData(d)
      if (!od.error) setOpenDeals(od)
      // reset live closed-deals so the auto-fetch effect re-runs with fresh cache
      setClosedDeals(null)
    } catch (err) {
      alert(`Sync error: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setSyncing(false)
    }
  }

  const base = { responsive: false, animation: { duration: 500 }, plugins: { legend: { display: false }, tooltip: tip }, scales: sc }

  useChart("c1", () => ({
    type: "line",
    data: { labels: data?.cumulative.map((m: any) => MONTH_LABELS[m.month] ?? m.month) ?? [], datasets: [
      { label:"Created",   data: data?.cumulative.map((m: any)=>m.created)  ?? [], borderColor:C.G, backgroundColor:"transparent", tension:.4, pointRadius:3, pointBackgroundColor:C.G, borderWidth:2.5 },
      { label:"Onboarded", data: data?.cumulative.map((m: any)=>m.onboarded)?? [], borderColor:C.P, backgroundColor:"transparent", tension:.4, pointRadius:3, pointBackgroundColor:C.P, borderWidth:2.5 },
      { label:"Funded",    data: data?.cumulative.map((m: any)=>m.funded)   ?? [], borderColor:C.A, backgroundColor:"transparent", tension:.4, pointRadius:3, pointBackgroundColor:C.A, borderWidth:2.5 },
    ]},
    options: { ...base, interaction:{mode:"index",intersect:false}, plugins: { ...base.plugins, legend: { display:true, labels:{color:C.MU,boxWidth:8,font:{size:10},padding:16} } } },
  }), [data, chartReady])

  useChart("c2", () => ({
    type: "bar",
    data: { labels: data?.byMonth.map((m: any) => MONTH_LABELS[m.month] ?? m.month) ?? [], datasets: [
      { label:"Created",   data: data?.byMonth.map((m: any)=>m.created)  ?? [], backgroundColor:C.Gd, borderColor:C.G, borderWidth:1.5, borderRadius:4 },
      { label:"Onboarded", data: data?.byMonth.map((m: any)=>m.onboarded)?? [], backgroundColor:C.Pd, borderColor:C.P, borderWidth:1.5, borderRadius:4 },
      { label:"Funded",    data: data?.byMonth.map((m: any)=>m.funded)   ?? [], backgroundColor:C.Ad, borderColor:C.A, borderWidth:1.5, borderRadius:4 },
    ]},
    options: { ...base, interaction:{mode:"index",intersect:false}, plugins: { ...base.plugins, legend: { display:true, labels:{color:C.MU,boxWidth:8,font:{size:10},padding:16} } } },
  }), [data, chartReady])

  const act = data?.activation
  useChart("c3", () => ({
    type: "bar",
    data: { labels: ["Created","Onboarded","Funded"], datasets: [{ data:[act?.created??0,act?.onboarded??0,act?.funded??0], backgroundColor:[C.Gd,C.Pd,C.Ad], borderColor:[C.G,C.P,C.A], borderWidth:1.5, borderRadius:5 }] },
    options: { ...base, indexAxis:"y", plugins: { ...base.plugins, tooltip: { ...tip, callbacks: { label: (c: any) => ` ${Number(c.raw)} (${Math.round(Number(c.raw)/(act?.created||1)*100)}%)` } } } },
  }), [data, chartReady])

  useChart("c4", () => ({
    type: "line",
    data: { labels: data?.cumulative.map((m: any) => MONTH_LABELS[m.month] ?? m.month) ?? [], datasets: [{ label:"Onboarding-rate", data: data?.cumulative.map((m: any)=>m.created>0?Math.round(m.onboarded/m.created*100):0)??[], borderColor:C.P, backgroundColor:"transparent", tension:.4, pointRadius:3, pointBackgroundColor:C.P, borderWidth:2.5 }] },
    options: { ...base, interaction:{mode:"index",intersect:false}, plugins: { ...base.plugins, tooltip:{ ...tip, callbacks:{ label:(c: any)=>` ${Number(c.raw)}%` } } }, scales:{ ...sc, y:{ ...sc.y, min:0, max:100, ticks:{ callback:(v: any)=>v+"%", color:C.MU, font:{size:10} } } } },
  }), [data, chartReady])

  useChart("c5", () => ({
    type: "doughnut",
    data: { labels:["VK fonde","Noterede","Likvider"], datasets:[{ data:[data?.auc.vkFunds??0, data?.auc.listed??0, data?.auc.cash??0], backgroundColor:[C.Pd,C.Ad,"rgba(45,104,176,.14)"], borderColor:[C.P,C.A,C.B], borderWidth:2, hoverOffset:5 }] },
    options: { responsive:false, cutout:"64%", animation:{duration:500}, plugins:{ legend:{display:true,position:"bottom",labels:{color:C.MU,boxWidth:8,font:{size:10},padding:12}}, tooltip:{...tip,callbacks:{label:(c: any)=>` ${fmt(Number(c.raw))}`}} } },
  }), [data, chartReady])

  useChart("c6", () => ({
    type: "bar",
    data: { labels: data?.seller.scriveSellers.slice(0,7).map((s: any)=>s.name.split(" ")[0])??[], datasets:[{ data:data?.seller.scriveSellers.slice(0,7).map((s: any)=>s.amount)??[], backgroundColor:C.Gd, borderColor:C.G, borderWidth:1.5, borderRadius:4 }] },
    options: { ...base, plugins:{...base.plugins,tooltip:{...tip,callbacks:{label:(c: any)=>` ${fmt(Number(c.raw))}`}}}, scales:{...sc,y:{...sc.y,ticks:{callback:(v: any)=>v>=1e6?(v/1e6).toFixed(1)+"M":(v/1e3).toFixed(0)+"K",color:C.MU,font:{size:10}}}} },
  }), [data, chartReady])

  useChart("c7", () => ({
    type: "bar",
    data: { labels: data?.seller.monthlyScrive.map((m: any)=>MONTH_LABELS[m.month]??m.month)??[], datasets:[{ data:data?.seller.monthlyScrive.map((m: any)=>m.deals)??[], backgroundColor:C.Bd, borderColor:C.B, borderWidth:1.5, borderRadius:4 }] },
    options: { ...base, plugins:{...base.plugins,tooltip:{...tip,callbacks:{label:(c: any)=>` ${Number(c.raw)} deals`}}} },
  }), [data, chartReady])

  useChart("c8", () => ({
    type: "doughnut",
    data: { labels: data?.funds.map((f: any)=>f.name)??[], datasets:[{ data:data?.funds.map((f: any)=>f.amount)??[], backgroundColor:[C.Pd,"rgba(21,97,76,.18)",C.Bd,C.Ad,"rgba(122,126,154,.18)"], borderColor:[C.P,C.G,C.B,C.A,C.MU], borderWidth:2, hoverOffset:5 }] },
    options: { responsive:false, cutout:"60%", animation:{duration:500}, plugins:{ legend:{display:true,position:"bottom",labels:{color:C.MU,boxWidth:8,font:{size:10},padding:10}}, tooltip:{...tip,callbacks:{label:(c: any)=>` ${fmt(Number(c.raw))}`}} } },
  }), [data, chartReady])

  useChart("c9", () => ({
    type: "doughnut",
    data: { labels: data?.seller.scriveFunds?.map((f: any)=>f.name)??[], datasets:[{ data:data?.seller.scriveFunds?.map((f: any)=>f.amount)??[], backgroundColor:[C.Gd,"rgba(90,73,152,.18)",C.Bd,C.Ad,"rgba(122,126,154,.18)"], borderColor:[C.G,C.P,C.B,C.A,C.MU], borderWidth:2, hoverOffset:5 }] },
    options: { responsive:false, cutout:"60%", animation:{duration:500}, plugins:{ legend:{display:true,position:"bottom",labels:{color:C.MU,boxWidth:8,font:{size:10},padding:10}}, tooltip:{...tip,callbacks:{label:(c: any)=>` ${fmt(Number(c.raw))}`}} } },
  }), [data, chartReady])

  // Pipeline tab charts (inline in dashboard)
  const FUNNEL_COLORS_PL = ["#172643","#2d68b0","#5a4998","#6b5cb8","#15624c","#ac9b70","#9ca7ad"]
  useChart("dk-pl-monthly", () => ({
    type: "bar",
    data: { labels:(pipelineData?.byMonth||[]).map((m: any)=>{const [y,mo]=m.month.split("-");return new Date(Number(y),Number(mo)-1).toLocaleDateString("en-GB",{month:"short",year:"2-digit"})}), datasets:[{label:"New leads",data:(pipelineData?.byMonth||[]).map((m: any)=>m.count),backgroundColor:"#172643",borderRadius:4}] },
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{grid:{display:false},ticks:{font:{size:10}}},y:{grid:{color:"rgba(18,20,40,.05)"},ticks:{font:{size:10}}}}},
  }), [chartReady, pipelineData, !!data])
  useChart("dk-pl-stages", () => {
    const sc2 = pipelineData?.stageCounts||{}
    return { type:"doughnut", data:{ labels:["Lead","MQL Cold","MQL Connected","Attempted","SQL","Opportunity","Customer"], datasets:[{data:["lead","marketingqualifiedlead","770940371","773079518","salesqualifiedlead","opportunity","customer"].map(k=>sc2[k]||0),backgroundColor:["#2d68b0","#5a4998","#6b5cb8","#8b7cc8","#ac9b70","#15624c","#172643"],borderWidth:0}] }, options:{responsive:true,maintainAspectRatio:false,cutout:"68%",plugins:{legend:{position:"right",labels:{font:{size:10},boxWidth:12}}}} }
  }, [chartReady, pipelineData, !!data])

  if (status === "loading" || (!data && !error)) {
    return <><nav style={{background:"var(--ink)",height:54}} /><div className="loading"><div className="spinner"/><span>Loading data…</span></div></>
  }
  if (data && (!data.seller || !data.auc || !data.funnel || !data.funds || !data.fundsPending || !data.topCustomers)) {
    return <><nav style={{background:"var(--ink)",height:54}} /><div className="loading"><div className="spinner"/><span>Processing data…</span></div></>
  }
  if (error) {
    return <><nav style={{background:"var(--ink)",height:54}} /><div className="loading"><span style={{color:"#c0392b"}}>{error}</span><button onClick={triggerSync} style={{marginTop:16,padding:"10px 24px",background:"var(--pur)",color:"#fff",border:"none",borderRadius:6,cursor:"pointer",fontFamily:"inherit",fontWeight:600}}>Sync now</button></div></>
  }

  const fetchedAt = data ? new Date(data.fetchedAt).toLocaleString("da-DK", {day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}) : "—"

  // Access control — rules from src/lib/access.ts, the same module the API
  // guards use, so the UI cannot offer a region the server would 403.
  const _access = resolveAccess(session?.user?.email)
  const userEmail = _access.email
  const userDomain = _access.domain
  const isAdminDomain     = _access.isAdmin
  const canAccessPipeline = _access.canPipeline
  const canAccessDK   = canReadRegion(_access, "dk")
  const canAccessSE   = canReadRegion(_access, "se")
  const canAccessShip    = canReadRegion(_access, "ship")
  const canAccessAT      = canReadRegion(_access, "at")
  const canAccessFI      = canReadRegion(_access, "fi")
  const canAccessNO      = canReadRegion(_access, "no")
  const canAccessCompass = _access.canCompass
  const maxFund        = data?.funds?.[0]?.amount ?? 1
  const maxScriveFund  = data?.seller.scriveFunds?.[0]?.amount ?? 1
  const maxPending     = data?.fundsPending?.[0]?.amount ?? 1
  const maxCust        = data?.topCustomers?.[0]?.totalAuc ?? 1
  const maxScrive      = data?.seller.scriveSellers?.[0]?.amount ?? 1
  const maxVn          = data?.seller.vnSellers?.[0]?.amount ?? 1

  const userTblHeaders = (
    <tr>
      <th style={th}>#</th>
      <th style={th}>Name</th>
      <th style={th}>Email</th>
      <th style={th}>Contact owner</th>
      <th style={th}>Signup</th>
    </tr>
  )

  const userTblRow = (c: any, i: number, color: string) => (
    <tr key={c.id}>
      <td style={td}><span className="rank">{i+1}</span></td>
      <td style={td}>
        <a href={`https://app-eu1.hubspot.com/contacts/${PORTAL}/contact/${c.id}`} target="_blank" rel="noreferrer" style={{color,textDecoration:"none",fontWeight:500}}>
          {c.name}
        </a>
      </td>
      <td style={{...td,color:"var(--ink3)",fontSize:11}}>{c.email}</td>
      <td style={{...td,fontSize:11,color:"var(--ink3)"}}>{c.owner}</td>
      <td style={{...td,fontSize:11,color:"var(--ink3)"}}>{c.signupTime ? new Date(c.signupTime).toLocaleDateString("da-DK") : "—"}</td>
    </tr>
  )

  const normStage = (s: string) => {
    if (s === "Signed" || s === "Won")     return "Closed Won"
    if (s === "Cancelled" || s === "Lost") return "Closed Lost"
    if (s === "Under tegning")             return "Subscription Form Sent"
    return s
  }
  const normDeal = (d: any) => ({...d, dealStage: normStage(d.dealStage)})

  // Section 1: filter by close date + dropdowns (for cache data)
  const applyClosedF = (items: any[]) => items.map(normDeal).filter(d => {
    if (c1From && d.closedate && new Date(d.closedate).getTime() < new Date(c1From).getTime()) return false
    if (c1To   && d.closedate && new Date(d.closedate).getTime() > new Date(c1To + "T23:59:59").getTime()) return false
    if (c1Stage    && d.dealStage !== c1Stage) return false
    if (c1Status   && d.subscriptionStatus !== c1Status) return false
    if (c1Pipeline && d.pipeline !== c1Pipeline) return false
    if (c1Owner    && d.owner !== c1Owner) return false
    return true
  })
  // Dropdown-only filter for live data (server already handles date filtering)
  const applyDropdownF = (items: any[]) => items.map(normDeal).filter(d => {
    if (c1Stage    && d.dealStage !== c1Stage) return false
    if (c1Status   && d.subscriptionStatus !== c1Status) return false
    if (c1Pipeline && d.pipeline !== c1Pipeline) return false
    if (c1Owner    && d.owner !== c1Owner) return false
    return true
  })

  const vnDeals = data?.vnDeals
  const byClose = (a: any, b: any) => new Date(b.closedate || "").getTime() - new Date(a.closedate || "").getTime()

  // Fund breakdown helper
  const buildFundBreakdown = (wonDeals: any[], filterFn: (d: any) => boolean) => {
    const map: Record<string, { deals: number; amount: number; dealList: any[] }> = {}
    for (const d of wonDeals.filter(filterFn)) {
      const pl = d.pipeline || "—"
      if (!map[pl]) map[pl] = { deals: 0, amount: 0, dealList: [] }
      map[pl].deals++; map[pl].amount += d.amount || 0
      map[pl].dealList.push({ name: d.name, amount: d.amount, id: d.id, owner: d.owner })
    }
    return Object.entries(map).map(([name, v]) => ({ name, ...v })).sort((a, b) => b.amount - a.amount)
  }

  // Pipeline Rapport — all deals YTD by createdate, all sources (must be before allWon/allLost)
  const rapportNeg  = (openDeals?.negotiations         ?? vnDeals?.salesNegotiations ?? []).map(normDeal)
  const rapportSub  = (openDeals?.subscriptionFormSent ?? vnDeals?.salesSubscription ?? []).map(normDeal)
  const rapportWon  = (openDeals?.closedWon  ?? [...(vnDeals?.endavuWon ?? []), ...(vnDeals?.salesWon ?? [])]).map(normDeal)
  const rapportLost = (openDeals?.closedLost ?? [...(vnDeals?.endavuLost ?? []), ...(vnDeals?.salesLost ?? [])]).map(normDeal)

  // Always prefer live closed-deals data; when an open stage is selected, pull from openDeals
  const isOpenStage = c1Stage === "Subscription Form Sent" || c1Stage === "Negotiations"
  const allWon = (
    c1Stage === "Subscription Form Sent" ? applyDropdownF(rapportSub) :
    c1Stage === "Negotiations"           ? applyDropdownF(rapportNeg) :
    closedDeals
      ? applyDropdownF(closedDeals.won)
      : [...applyClosedF(vnDeals?.endavuWon ?? []), ...applyClosedF(vnDeals?.salesWon ?? [])]
  ).sort(byClose)
  const allWonAmt = allWon.reduce((s: number, d: any) => s + d.amount, 0)

  const allLost = isOpenStage ? [] : (closedDeals
    ? applyDropdownF(closedDeals.lost)
    : [...applyClosedF(vnDeals?.endavuLost ?? []), ...applyClosedF(vnDeals?.salesLost ?? [])]
  ).sort(byClose)
  const allLostAmt = allLost.reduce((s: number, d: any) => s + d.amount, 0)

  const fundDateWon = fundDateDeals?.won ?? []
  const scriveFundsByDate = (fundDateFrom || fundDateTo) ? buildFundBreakdown(fundDateWon, (d: any) => !d.endavuId) : null
  const vnFundsByDate     = (fundDateFrom || fundDateTo) ? buildFundBreakdown(fundDateWon, (d: any) => !!d.endavuId) : null

  // Active fund lists — date-filtered when a range is set, else static YTD/since-launch cache
  const activeFundsScrive: any[] = scriveFundsByDate ?? data?.seller.scriveFunds ?? []
  const activeFundsVn: any[]     = vnFundsByDate     ?? data?.funds ?? []
  const maxActiveFundScrive = activeFundsScrive[0]?.amount ?? 1
  const maxActiveFundVn     = activeFundsVn[0]?.amount ?? 1

  const fundScriveTotals = { deals: activeFundsScrive.reduce((s: number, f: any) => s + f.deals, 0), amount: activeFundsScrive.reduce((s: number, f: any) => s + f.amount, 0) }
  const fundVnTotals     = { deals: activeFundsVn.reduce((s: number, f: any) => s + f.deals, 0),     amount: activeFundsVn.reduce((s: number, f: any) => s + f.amount, 0) }
  const fundDateLabel = (fundDateFrom || fundDateTo) ? `${fundDateFrom || "…"} — ${fundDateTo || "…"}` : null

  // Onboarding Overview — all deals unfiltered (both sources)
  const ovWon    = [...(vnDeals?.endavuWon ?? []), ...(vnDeals?.salesWon ?? [])].map(normDeal)
  const ovLost   = [...(vnDeals?.endavuLost ?? []), ...(vnDeals?.salesLost ?? [])].map(normDeal)
  const ovActive = [
    ...(openDeals?.negotiations         ?? vnDeals?.salesNegotiations ?? []),
    ...(openDeals?.subscriptionFormSent ?? vnDeals?.salesSubscription ?? []),
  ].map(normDeal)

  const allVnDeals = vnDeals ? [
    ...vnDeals.endavuWon, ...vnDeals.endavuLost,
    ...vnDeals.salesWon,  ...vnDeals.salesLost,
    ...(vnDeals.salesNegotiations ?? []), ...(vnDeals.salesSubscription ?? []),
  ].map(normDeal) : []
  const uniq = (arr: string[]) => [...new Set(arr)].filter(Boolean).sort()
  const statusOpts   = uniq(allVnDeals.map((d: any) => d.subscriptionStatus).filter((s: string) => s !== "—"))
  const pipelineOpts = uniq(allVnDeals.map((d: any) => d.pipeline))
  const ownerOpts    = uniq(allVnDeals.map((d: any) => d.owner).filter((o: string) => o && o !== "—"))
  const hasFilter1   = !!(c1From || c1To || c1Stage || c1Status || c1Pipeline || c1Owner)

  // SE computed values
  const seWon  = ((seClosedDeals?.won  ?? []) as any[]).map(normDeal)
  const seLost = ((seClosedDeals?.lost ?? []) as any[]).map(normDeal)
  const seWonAmt  = seWon.reduce((s: number, d: any) => s + d.amount, 0)
  const seLostAmt = seLost.reduce((s: number, d: any) => s + d.amount, 0)
  const seRapportNeg  = ((seOpenDeals?.negotiations         ?? []) as any[]).map(normDeal)
  const seRapportSub  = ((seOpenDeals?.subscriptionFormSent ?? []) as any[]).map(normDeal)
  const seRapportWon  = ((seOpenDeals?.closedWon  ?? seWon ) as any[]).map(normDeal)
  const seRapportLost = ((seOpenDeals?.closedLost ?? seLost) as any[]).map(normDeal)
  const seAllDeals = [...seWon, ...seLost, ...seRapportNeg, ...seRapportSub]
  const seOwnerOpts    = [...new Set(seAllDeals.map((d: any) => d.owner).filter((o: string) => o && o !== "—"))].sort()
  const sePipelineOpts = [...new Set(seAllDeals.map((d: any) => d.pipeline).filter((p: string) => p && p !== "—"))].sort()
  const seHasFilter    = !!(seC1From || seC1To || seC1Stage || seC1Pipeline || seC1Owner)
  const applySeFilter  = (items: any[]) => items.filter((d: any) => {
    if (seC1Stage    && d.dealStage !== seC1Stage)    return false
    if (seC1Pipeline && d.pipeline  !== seC1Pipeline) return false
    if (seC1Owner    && d.owner     !== seC1Owner)    return false
    return true
  })
  const seIsOpenStage = seC1Stage === "Subscription Form Sent" || seC1Stage === "Negotiations"
  const seWonF  = applySeFilter(
    seC1Stage === "Subscription Form Sent" ? seRapportSub :
    seC1Stage === "Negotiations"           ? seRapportNeg :
    seWon
  )
  const seLostF = seIsOpenStage ? [] : applySeFilter(seLost)

  // SE fund breakdown
  const seActiveFundsSource = (seFundDateFrom || seFundDateTo) ? (seFundDateDeals?.won ?? []) : seClosedDeals?.won ?? []
  const seFunds: any[]      = buildFundBreakdown(seActiveFundsSource, () => true)
  const maxSeFund           = seFunds[0]?.amount ?? 1
  const seFundTotals        = { deals: seFunds.reduce((s: number, f: any) => s + f.deals, 0), amount: seFunds.reduce((s: number, f: any) => s + f.amount, 0) }
  const seFundDateLabel     = (seFundDateFrom || seFundDateTo) ? `${seFundDateFrom || "…"} — ${seFundDateTo || "…"}` : null

  // Ship computed values
  const shipWon  = ((shipClosedDeals?.won  ?? []) as any[]).map(normDeal)
  const shipLost = ((shipClosedDeals?.lost ?? []) as any[]).map(normDeal)
  const shipRapportNeg  = ((shipOpenDeals?.negotiations         ?? []) as any[]).map(normDeal)
  const shipRapportSub  = ((shipOpenDeals?.subscriptionFormSent ?? []) as any[]).map(normDeal)
  const shipRapportWon  = ((shipOpenDeals?.closedWon  ?? shipWon ) as any[]).map(normDeal)
  const shipRapportLost = ((shipOpenDeals?.closedLost ?? shipLost) as any[]).map(normDeal)
  const shipAllDeals     = [...shipWon, ...shipLost, ...shipRapportNeg, ...shipRapportSub]
  const shipOwnerOpts    = [...new Set(shipAllDeals.map((d: any) => d.owner).filter((o: string) => o && o !== "—"))].sort()
  const shipPipelineOpts = [...new Set(shipAllDeals.map((d: any) => d.pipeline).filter((p: string) => p && p !== "—"))].sort()
  const shipHasFilter    = !!(shipC1From || shipC1To || shipC1Stage || shipC1Pipeline || shipC1Owner)
  const applyShipFilter  = (items: any[]) => items.filter((d: any) => {
    if (shipC1Stage    && d.dealStage !== shipC1Stage)    return false
    if (shipC1Pipeline && d.pipeline  !== shipC1Pipeline) return false
    if (shipC1Owner    && d.owner     !== shipC1Owner)    return false
    return true
  })
  const shipIsOpenStage = shipC1Stage === "Subscription Form Sent" || shipC1Stage === "Negotiations"
  const shipWonF  = applyShipFilter(
    shipC1Stage === "Subscription Form Sent" ? shipRapportSub :
    shipC1Stage === "Negotiations"           ? shipRapportNeg :
    shipWon
  )
  const shipLostF = shipIsOpenStage ? [] : applyShipFilter(shipLost)
  const shipActiveFundsSource = (shipFundDateFrom || shipFundDateTo) ? (shipFundDateDeals?.won ?? []) : shipClosedDeals?.won ?? []
  const shipFunds: any[]      = buildFundBreakdown(shipActiveFundsSource, () => true)
  const maxShipFund           = shipFunds[0]?.amount ?? 1
  const shipFundTotals        = { deals: shipFunds.reduce((s: number, f: any) => s + f.deals, 0), amount: shipFunds.reduce((s: number, f: any) => s + f.amount, 0) }
  const shipFundDateLabel     = (shipFundDateFrom || shipFundDateTo) ? `${shipFundDateFrom || "…"} — ${shipFundDateTo || "…"}` : null

  // AT computed values
  const atWon  = ((atClosedDeals?.won  ?? []) as any[]).map(normDeal)
  const atLost = ((atClosedDeals?.lost ?? []) as any[]).map(normDeal)
  const atRapportNeg  = ((atOpenDeals?.negotiations         ?? []) as any[]).map(normDeal)
  const atRapportSub  = ((atOpenDeals?.subscriptionFormSent ?? []) as any[]).map(normDeal)
  const atRapportWon  = ((atOpenDeals?.closedWon  ?? atWon ) as any[]).map(normDeal)
  const atRapportLost = ((atOpenDeals?.closedLost ?? atLost) as any[]).map(normDeal)
  const atAllDeals     = [...atWon, ...atLost, ...atRapportNeg, ...atRapportSub]
  const atOwnerOpts    = [...new Set(atAllDeals.map((d: any) => d.owner).filter((o: string) => o && o !== "—"))].sort()
  const atPipelineOpts = [...new Set(atAllDeals.map((d: any) => d.pipeline).filter((p: string) => p && p !== "—"))].sort()
  const atHasFilter    = !!(atC1From || atC1To || atC1Stage || atC1Pipeline || atC1Owner)
  const applyATFilter  = (items: any[]) => items.filter((d: any) => {
    if (atC1Stage    && d.dealStage !== atC1Stage)    return false
    if (atC1Pipeline && d.pipeline  !== atC1Pipeline) return false
    if (atC1Owner    && d.owner     !== atC1Owner)    return false
    return true
  })
  const atIsOpenStage = atC1Stage === "Subscription Form Sent" || atC1Stage === "Negotiations"
  const atWonF  = applyATFilter(
    atC1Stage === "Subscription Form Sent" ? atRapportSub :
    atC1Stage === "Negotiations"           ? atRapportNeg :
    atWon
  )
  const atLostF = atIsOpenStage ? [] : applyATFilter(atLost)
  const atActiveFundsSource = (atFundDateFrom || atFundDateTo) ? (atFundDateDeals?.won ?? []) : atClosedDeals?.won ?? []
  const atFunds: any[]      = buildFundBreakdown(atActiveFundsSource, () => true)
  const maxATFund           = atFunds[0]?.amount ?? 1
  const atFundTotals        = { deals: atFunds.reduce((s: number, f: any) => s + f.deals, 0), amount: atFunds.reduce((s: number, f: any) => s + f.amount, 0) }
  const atFundDateLabel     = (atFundDateFrom || atFundDateTo) ? `${atFundDateFrom || "…"} — ${atFundDateTo || "…"}` : null

  // FI computed values
  const fiWon  = ((fiClosedDeals?.won  ?? []) as any[]).map(normDeal)
  const fiLost = ((fiClosedDeals?.lost ?? []) as any[]).map(normDeal)
  const fiRapportNeg  = ((fiOpenDeals?.negotiations         ?? []) as any[]).map(normDeal)
  const fiRapportSub  = ((fiOpenDeals?.subscriptionFormSent ?? []) as any[]).map(normDeal)
  const fiRapportWon  = ((fiOpenDeals?.closedWon  ?? fiWon ) as any[]).map(normDeal)
  const fiRapportLost = ((fiOpenDeals?.closedLost ?? fiLost) as any[]).map(normDeal)
  const fiAllDeals     = [...fiWon, ...fiLost, ...fiRapportNeg, ...fiRapportSub]
  const fiOwnerOpts    = [...new Set(fiAllDeals.map((d: any) => d.owner).filter((o: string) => o && o !== "—"))].sort()
  const fiPipelineOpts = [...new Set(fiAllDeals.map((d: any) => d.pipeline).filter((p: string) => p && p !== "—"))].sort()
  const fiHasFilter    = !!(fiC1From || fiC1To || fiC1Stage || fiC1Pipeline || fiC1Owner)
  const applyFIFilter  = (items: any[]) => items.filter((d: any) => {
    if (fiC1Stage    && d.dealStage !== fiC1Stage)    return false
    if (fiC1Pipeline && d.pipeline  !== fiC1Pipeline) return false
    if (fiC1Owner    && d.owner     !== fiC1Owner)    return false
    return true
  })
  const fiIsOpenStage = fiC1Stage === "Subscription Form Sent" || fiC1Stage === "Negotiations"
  const fiWonF  = applyFIFilter(fiC1Stage === "Subscription Form Sent" ? fiRapportSub : fiC1Stage === "Negotiations" ? fiRapportNeg : fiWon)
  const fiLostF = fiIsOpenStage ? [] : applyFIFilter(fiLost)
  const fiActiveFundsSource = (fiFundDateFrom || fiFundDateTo) ? (fiFundDateDeals?.won ?? []) : fiClosedDeals?.won ?? []
  const fiFunds: any[]      = buildFundBreakdown(fiActiveFundsSource, () => true)
  const maxFiFund           = fiFunds[0]?.amount ?? 1
  const fiFundTotals        = { deals: fiFunds.reduce((s: number, f: any) => s + f.deals, 0), amount: fiFunds.reduce((s: number, f: any) => s + f.amount, 0) }
  const fiFundDateLabel     = (fiFundDateFrom || fiFundDateTo) ? `${fiFundDateFrom || "…"} — ${fiFundDateTo || "…"}` : null

  // NO computed values
  const noWon  = ((noClosedDeals?.won  ?? []) as any[]).map(normDeal)
  const noLost = ((noClosedDeals?.lost ?? []) as any[]).map(normDeal)
  const noRapportNeg  = ((noOpenDeals?.negotiations         ?? []) as any[]).map(normDeal)
  const noRapportSub  = ((noOpenDeals?.subscriptionFormSent ?? []) as any[]).map(normDeal)
  const noRapportWon  = ((noOpenDeals?.closedWon  ?? noWon ) as any[]).map(normDeal)
  const noRapportLost = ((noOpenDeals?.closedLost ?? noLost) as any[]).map(normDeal)
  const noAllDeals     = [...noWon, ...noLost, ...noRapportNeg, ...noRapportSub]
  const noOwnerOpts    = [...new Set(noAllDeals.map((d: any) => d.owner).filter((o: string) => o && o !== "—"))].sort()
  const noPipelineOpts = [...new Set(noAllDeals.map((d: any) => d.pipeline).filter((p: string) => p && p !== "—"))].sort()
  const noHasFilter    = !!(noC1From || noC1To || noC1Stage || noC1Pipeline || noC1Owner)
  const applyNOFilter  = (items: any[]) => items.filter((d: any) => {
    if (noC1Stage    && d.dealStage !== noC1Stage)    return false
    if (noC1Pipeline && d.pipeline  !== noC1Pipeline) return false
    if (noC1Owner    && d.owner     !== noC1Owner)    return false
    return true
  })
  const noIsOpenStage = noC1Stage === "Subscription Form Sent" || noC1Stage === "Negotiations"
  const noWonF  = applyNOFilter(noC1Stage === "Subscription Form Sent" ? noRapportSub : noC1Stage === "Negotiations" ? noRapportNeg : noWon)
  const noLostF = noIsOpenStage ? [] : applyNOFilter(noLost)
  const noActiveFundsSource = (noFundDateFrom || noFundDateTo) ? (noFundDateDeals?.won ?? []) : noClosedDeals?.won ?? []
  const noFunds: any[]      = buildFundBreakdown(noActiveFundsSource, () => true)
  const maxNOFund           = noFunds[0]?.amount ?? 1
  const noFundTotals        = { deals: noFunds.reduce((s: number, f: any) => s + f.deals, 0), amount: noFunds.reduce((s: number, f: any) => s + f.amount, 0) }
  const noFundDateLabel     = (noFundDateFrom || noFundDateTo) ? `${noFundDateFrom || "…"} — ${noFundDateTo || "…"}` : null

  const selStyle = {fontSize:12,padding:"6px 10px",border:"1px solid var(--bdr)",borderRadius:4,fontFamily:"inherit",color:"var(--ink2)",background:"#fff",cursor:"pointer"}
  const lblStyle = {fontSize:11,fontWeight:700,letterSpacing:".07em",textTransform:"uppercase" as const,color:"var(--ink3)",marginBottom:2}

  const vnDealTable = (rows: any[], color: string, dateMode: "created" | "closed" = "created", showSignedVia = false, fmtAmt = fmt, portal = PORTAL) => (
    <div style={{overflowY:"auto",maxHeight:"480px"}}>
      <table style={{width:"100%",borderCollapse:"collapse"}}>
        <thead style={{position:"sticky",top:0,background:"var(--bei)",zIndex:1}}>
          <tr>
            <th style={th}>#</th><th style={th}>Deal</th><th style={th}>Subscription Status</th>
            <th style={th}>Pipeline Stage</th><th style={{...th,textAlign:"right"}}>Amount</th>
            {showSignedVia && <th style={th}>Signed Via</th>}
            <th style={th}>Pipeline</th>
            <th style={th}>{dateMode === "closed" ? "Closed" : "Created"}</th>
            <th style={th}>Deal Owner</th>
          </tr>
        </thead>
        <tbody>{rows.length > 0 ? rows.map((d: any, i: number) => (
          <tr key={d.id}>
            <td style={td}><span className="rank">{i+1}</span></td>
            <td style={td}><a href={`https://app-eu1.hubspot.com/contacts/${portal}/record/0-3/${d.id}`} target="_blank" rel="noreferrer" style={{color,textDecoration:"none",fontWeight:500}}>{d.name}</a></td>
            <td style={{...td,fontSize:11}}>
              {d.subscriptionStatus !== "—" ? <span style={{fontSize:9,fontWeight:600,letterSpacing:".06em",textTransform:"uppercase",padding:"2px 6px",borderRadius:3,background:"rgba(90,73,152,.1)",color:"var(--pur)"}}>{d.subscriptionStatus}</span> : <span style={{color:"var(--ink3)"}}>—</span>}
            </td>
            <td style={{...td,fontSize:11,color:"var(--ink3)"}}>{d.dealStage}</td>
            <td style={{...tdr,fontWeight:600,color}}>{d.amount > 0 ? fmtAmt(d.amount) : "—"}</td>
            {showSignedVia && <td style={{...td,fontSize:11,color:"var(--ink3)"}}>{d.signedVia || "—"}</td>}
            <td style={{...td,fontSize:11,color:"var(--ink3)"}}>{d.pipeline}</td>
            <td style={{...td,fontSize:11,color:"var(--ink3)"}}>
              {dateMode === "closed"
                ? (d.closedate ? new Date(d.closedate).toLocaleDateString("da-DK") : "—")
                : (d.createdate ? new Date(d.createdate).toLocaleDateString("da-DK") : "—")}
            </td>
            <td style={{...td,fontSize:11,color:"var(--ink3)"}}>{d.owner || "—"}</td>
          </tr>
        )) : (
          <tr><td colSpan={showSignedVia ? 9 : 8} style={{...td,textAlign:"center",color:"var(--ink3)",padding:"24px"}}>No deals in this filter</td></tr>
        )}</tbody>
      </table>
    </div>
  )

  return (
    <div>
      <nav>
        <div className="nav-l">
          <a href="/" style={{display:"flex",alignItems:"center",textDecoration:"none"}}>
            <img src="/vaekstkapital-logo.webp" alt="Vaekstkapital" style={{height:22,width:"auto",objectFit:"contain"}} />
          </a>
          <button onClick={() => router.push("/")} style={{cursor:"pointer",border:"1px solid rgba(255,255,255,.25)",fontFamily:"inherit",background:"transparent",padding:"0 12px",height:28,borderRadius:4,fontSize:11,fontWeight:600,letterSpacing:".06em",color:"rgba(255,255,255,.8)"}}>
            ← Go back to Main
          </button>
          {canAccessPipeline && (
            <button onClick={() => router.push("/investortur")} className="chip" style={{cursor:"pointer",border:"none",fontFamily:"inherit",background:"#15624c",position:"relative",overflow:"hidden",padding:"0",minWidth:110,height:28,borderRadius:4}}>
              <span style={{position:"relative",zIndex:1,display:"flex",alignItems:"center",gap:5,padding:"0 12px",height:"100%",fontSize:11,fontWeight:700,letterSpacing:".06em",color:"#fff"}}>Investor Tour</span>
            </button>
          )}
          {isAdminDomain && (
            <button onClick={() => router.push("/salgsrapport")} className="chip" style={{cursor:"pointer",border:"none",fontFamily:"inherit",background:"#1d4ed8",position:"relative",overflow:"hidden",padding:"0",minWidth:110,height:28,borderRadius:4}}>
              <span style={{position:"relative",zIndex:1,display:"flex",alignItems:"center",gap:5,padding:"0 12px",height:"100%",fontSize:11,fontWeight:700,letterSpacing:".06em",color:"#fff"}}>Sales Report</span>
            </button>
          )}
          {canAccessPipeline && (()=>{ const brandMap: Record<string,string> = {dk:"0",se:"17424990",ship:"17893427",at:"18387361",fi:"17065112",no:"17435297"}; const b=brandMap[region]; return (
            <button onClick={()=>router.push(b?`/pipeline?brand=${b}`:"/pipeline")} className="chip" style={{cursor:"pointer",border:"none",fontFamily:"inherit",background:"#2d68b0",position:"relative",overflow:"hidden",padding:"0",minWidth:130,height:28,borderRadius:4}}>
              <span style={{position:"relative",zIndex:1,display:"flex",alignItems:"center",gap:5,padding:"0 12px",height:"100%",fontSize:11,fontWeight:700,letterSpacing:".06em",color:"#fff"}}>Contact Pipeline</span>
            </button>
          )})()}
          {canAccessCompass && (
            <button onClick={() => router.push("/dashboard?region=compass")} className="chip"
              style={{cursor:"pointer",border: region === "compass" ? "none" : "1px solid rgba(255,255,255,.25)",fontFamily:"inherit",background: region === "compass" ? "#6d3b8e" : "transparent",position:"relative",overflow:"hidden",padding:"0",minWidth:140,height:28,borderRadius:4}}>
              <span style={{position:"relative",zIndex:1,display:"flex",alignItems:"center",gap:5,padding:"0 12px",height:"100%",fontSize:11,fontWeight:700,letterSpacing:".06em",color: region === "compass" ? "#fff" : "rgba(255,255,255,.75)"}}>Compass · Vaekstnet</span>
            </button>
          )}
        </div>
        <div className="nav-r">
          <div className="live"><span className="live-dot"/>Data · HubSpot</div>
          <span className="sync-time">Last fetched: {fetchedAt}</span>
          <button onClick={() => exportCSV(data)} style={{fontSize:10,fontWeight:600,letterSpacing:".06em",textTransform:"uppercase",padding:"4px 12px",border:"1px solid rgba(255,255,255,.2)",borderRadius:4,background:"transparent",color:"rgba(255,255,255,.5)",cursor:"pointer",fontFamily:"inherit"}}>Export CSV</button>
          <button onClick={triggerSync} disabled={syncing} style={{fontSize:10,fontWeight:600,letterSpacing:".06em",textTransform:"uppercase",padding:"4px 12px",border:"1px solid rgba(255,255,255,.2)",borderRadius:4,background:"transparent",color:"rgba(255,255,255,.5)",cursor:"pointer",fontFamily:"inherit"}}>
            {syncing ? "Syncing…" : "Sync now"}
          </button>
          <button onClick={() => signOut({ callbackUrl:"/login" })} style={{fontSize:10,fontWeight:600,letterSpacing:".06em",textTransform:"uppercase",padding:"4px 12px",border:"1px solid rgba(255,255,255,.12)",borderRadius:4,background:"transparent",color:"rgba(255,255,255,.3)",cursor:"pointer",fontFamily:"inherit"}}>
            Log out ({session?.user?.name?.split(" ")[0]})
          </button>
        </div>
      </nav>

      {(() => {
        const regionName: Record<string,string> = {dk:"Denmark",se:"Sweden",ship:"Shipping",at:"Austria",fi:"Finland",no:"Norway",compass:"Compass · Vaekstnet"}
        return (
          <div style={{position:"sticky",top:"54px",zIndex:10,background:"var(--bei)",borderBottom:"1px solid var(--bdr)",display:"flex",gap:0,padding:"0 24px"}}>
            <button style={{fontSize:11,fontWeight:600,letterSpacing:".06em",textTransform:"uppercase",padding:"12px 20px",border:"none",borderBottom:"2px solid var(--grn)",background:"transparent",color:"var(--grn)",cursor:"default",fontFamily:"inherit",marginBottom:-1}}>
              {regionName[region]||""} Deals
            </button>
          </div>
        )
      })()}

      <main style={{display: tab==="deals" ? "" : "none"}}>
        {/* ── DK Denmark ──────────────────────────────────────────────────────── */}
        <div style={{display: region==="dk" ? "" : "none"}}>
        {/* old DK pipeline section — hidden; Contact Pipeline tab shown globally above */}
        <div style={{display:"none"}}>
        {pipelineData && (()=>{
          const pl=pipelineData,fd2=pl.funnelData||[],ft2=fd2[0]?.count||1,rv2=pl.reinvestering||{},sc2=pl.stageCounts||{}
          const p2=(n: number,t: number)=>t>0?Math.round(n/t*100):0
          return (<>
          <div className="lbl"><span className="lbl-text">Lead Activation · VaekstKapital Group</span></div>
          <div className="g4">
            <div className="kpi c-ink"><div className="kpi-lbl">Total Leads</div><div className="kpi-val sm" style={{color:"var(--blu)"}}>{(pl.totalContacts||0).toLocaleString("en-GB")}</div><div className="kpi-sub">Excl. VaekstNet</div></div>
            <div className="kpi c-grn"><div className="kpi-lbl">Customers (Won)</div><div className="kpi-val sm">{(sc2.customer||0).toLocaleString("en-GB")}</div><div className="kpi-sub">{p2(sc2.customer,pl.totalContacts)}% of leads</div></div>
            <div className="kpi c-gld"><div className="kpi-lbl">Stuck Leads</div><div className="kpi-val sm" style={{color:"var(--gld)"}}>{(pl.stuckLeads?.length||0).toLocaleString("en-GB")}</div><div className="kpi-sub">&gt;30 days no progress</div></div>
            <div className="kpi c-pur"><div className="kpi-lbl">Reinvesting</div><div className="kpi-val sm">{rv2.reinvestRate||0}%</div><div className="kpi-sub">Median {rv2.medianDays||0} days</div></div>
          </div>
          <div className="lbl"><span className="lbl-text">Activation Funnel</span></div>
          <div className="g2">
            <div className="cc"><div className="cc-head"><div><div className="cc-title">Activation Funnel</div><div className="cc-sub">Leads reaching each stage</div></div></div>
              {fd2.map((row: any,i: number)=>(<div key={row.stage} style={{display:"flex",alignItems:"center",gap:12,marginBottom:8}}><div style={{width:160,fontSize:12,color:"var(--ink2)",flexShrink:0}}>{row.stage}</div><div style={{flex:1,background:"var(--bdr)",borderRadius:4,height:14,overflow:"hidden"}}><div style={{width:`${p2(row.count,ft2)}%`,height:"100%",background:["#172643","#2d68b0","#5a4998","#6b5cb8","#15624c","#ac9b70","#9ca7ad"][i]||"#172643",borderRadius:4}}/></div><div style={{fontSize:12,fontWeight:700,color:"var(--ink1)",minWidth:60,textAlign:"right"}}>{row.count.toLocaleString("da-DK")}</div><div style={{fontSize:11,color:"var(--ink3)",minWidth:40,textAlign:"right"}}>{p2(row.count,ft2)}%</div></div>))}
            </div>
            <div className="cc"><div className="cc-head"><div><div className="cc-title">Stage Distribution</div></div></div><div style={{height:220}}><canvas id="dk-pl-stages"/></div></div>
          </div>
          <div className="lbl"><span className="lbl-text">New leads per month</span></div>
          <div className="cc mt"><div className="cc-head"><div><div className="cc-title">New leads per month</div><div className="cc-sub">Last 18 months</div></div></div><div style={{height:180}}><canvas id="dk-pl-monthly"/></div></div>
          <div className="lbl" style={{marginTop:32}}><span className="lbl-text">Average time between stages</span></div>
          <div className="cc">
            <div className="cc-head"><div><div className="cc-title">Average time between stages</div><div className="cc-sub">Avg / median · standard HubSpot stages with known dates only</div></div></div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))",gap:10}}>
              {Object.entries(pl.avgDaysPerTransition||{}).map(([label,val]: any)=>(
                <div key={label} style={{background:"var(--bei,#f7f5f0)",border:"1px solid var(--bdr)",borderRadius:8,padding:"12px 14px"}}>
                  <div style={{fontSize:26,fontWeight:700,color:"var(--ink)",letterSpacing:"-.02em"}}>{val.avg??val}</div>
                  <div style={{fontSize:10,color:"var(--ink3)",marginTop:2}}>days (avg)</div>
                  {val.median!==undefined&&<div style={{fontSize:11,color:"var(--pur)",marginTop:4,fontWeight:600}}>{val.median} median</div>}
                  {val.count!==undefined&&<div style={{fontSize:9,color:"var(--ink3)",marginTop:2}}>{val.count} data points</div>}
                  <div style={{fontSize:9,fontWeight:600,letterSpacing:".06em",textTransform:"uppercase" as const,color:"var(--ink3)",marginTop:8}}>{label}</div>
                </div>
              ))}
              {Object.keys(pl.avgDaysPerTransition||{}).length===0&&<div style={{color:"var(--ink3)",fontSize:12,fontStyle:"italic"}}>No data — click Sync to fetch from HubSpot</div>}
            </div>
          </div>
          {Object.keys(pl.avgDaysInCurrentStage||{}).length>0&&(<>
          <div className="lbl" style={{marginTop:32}}><span className="lbl-text">Time in current stage</span></div>
          <div className="cc">
            <div className="cc-head"><div><div className="cc-title">Time in current stage</div><div className="cc-sub">Avg / median days · * = approximated via last activity</div></div></div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))",gap:10}}>
              {Object.entries(pl.avgDaysInCurrentStage).map(([label,val]: any)=>{
                const days=val.avg??val,isApprox=val.dataSource==="last_activity_approx"
                const [bg,col]=days<14?["#d1fae5","#065f46"]:days<30?["#fef3c7","#92400e"]:["#fee2e2","#b91c1c"]
                return (
                  <div key={label} style={{background:bg,border:"1px solid rgba(0,0,0,.06)",borderRadius:8,padding:"12px 14px"}}>
                    <div style={{fontSize:26,fontWeight:700,color:col,letterSpacing:"-.02em"}}>{days}{isApprox?"*":""}</div>
                    <div style={{fontSize:10,color:"var(--ink3)",marginTop:2}}>days (avg)</div>
                    {val.median!==undefined&&<div style={{fontSize:11,color:col,marginTop:4,fontWeight:600}}>{val.median} median</div>}
                    {val.count!==undefined&&<div style={{fontSize:9,color:"var(--ink3)",marginTop:2}}>{val.count} leads</div>}
                    <div style={{fontSize:9,fontWeight:600,letterSpacing:".06em",textTransform:"uppercase" as const,color:"var(--ink3)",marginTop:8}}>{label}</div>
                  </div>
                )
              })}
            </div>
          </div>
          </>)}
          {rv2.totalCustomers>0&&(<>
          <div className="lbl" style={{marginTop:32}}><span className="lbl-text">Reinvestment</span></div>
          <div className="g4">
            <div className="kpi c-grn"><div className="kpi-lbl">Reinvesting</div><div className="kpi-val sm">{rv2.reinvestRate}%</div><div className="kpi-sub">{rv2.reinvestedCount} of {rv2.totalCustomers} customers</div></div>
            <div className="kpi c-blu"><div className="kpi-lbl">Median time to 2nd deal</div><div className="kpi-val sm">{rv2.medianDays}</div><div className="kpi-sub">days · avg {rv2.avgDays} days</div></div>
            <div className="kpi c-gld"><div className="kpi-lbl">Within 90 days</div><div className="kpi-val sm">{rv2.reinvestedCount>0?Math.round((rv2.within90days/rv2.reinvestedCount)*100):0}%</div><div className="kpi-sub">{rv2.within90days} customers reinvest quickly</div></div>
            <div className="kpi c-pur"><div className="kpi-lbl">Within 180 days</div><div className="kpi-val sm">{rv2.reinvestedCount>0?Math.round((rv2.within180days/rv2.reinvestedCount)*100):0}%</div><div className="kpi-sub">{rv2.within180days} customers within 6 months</div></div>
          </div>
          </>)}
          {(pl.byOwner||[]).length>0&&(<div className="mt"><div className="lbl"><span className="lbl-text">Leads per salesperson</span></div><div className="tcard"><div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr>{["Salesperson","Lead","MQL","SQL","Opp.","Customers","Total"].map((h: string,i: number)=><th key={h} style={{fontSize:10,fontWeight:600,letterSpacing:".07em",textTransform:"uppercase" as const,color:"var(--ink3)",padding:"7px 16px",textAlign:i===0?"left" as const:"right" as const,borderBottom:"1px solid var(--bdr)"}}>{h}</th>)}</tr></thead><tbody>{(pl.byOwner as any[]).map((o: any)=>(<tr key={o.name}><td style={{padding:"9px 16px",borderBottom:"1px solid var(--bdr)",color:"var(--ink2)",fontSize:12,fontWeight:600}}>{o.name}</td>{[o.lead,o.mql,o.sql,o.opportunity,o.customer,o.lead+o.mql+o.sql+o.opportunity+o.customer].map((v: number,i: number)=><td key={i} style={{padding:"9px 16px",borderBottom:"1px solid var(--bdr)",color:i===4?"var(--grn)":"var(--ink2)",fontSize:12,textAlign:"right" as const,fontWeight:i>=4?700:400}}>{v}</td>)}</tr>))}</tbody></table></div></div></div>)}
          {(pl.stuckLeads?.length||0)>0&&(<div className="mt"><div className="lbl"><span className="lbl-text">Stuck leads · &gt;30 days</span></div><div className="tcard"><div style={{overflowY:"auto",maxHeight:340}}><table style={{width:"100%",borderCollapse:"collapse"}}><thead style={{position:"sticky",top:0,background:"var(--bei)",zIndex:1}}><tr>{["Name","Stage","Days","Salesperson","Last Active","HubSpot"].map(h=><th key={h} style={{fontSize:10,fontWeight:600,letterSpacing:".07em",textTransform:"uppercase" as const,color:"var(--ink3)",padding:"7px 16px",textAlign:"left" as const,borderBottom:"1px solid var(--bdr)"}}>{h}</th>)}</tr></thead><tbody>{(pl.stuckLeads as any[]).map((l: any)=>(<tr key={l.id}><td style={{padding:"9px 16px",borderBottom:"1px solid var(--bdr)",fontSize:12}}><div style={{fontWeight:500,color:"var(--ink1)"}}>{l.name||"—"}</div><div style={{fontSize:10,color:"var(--ink3)"}}>{l.email}</div></td><td style={{padding:"9px 16px",borderBottom:"1px solid var(--bdr)",fontSize:12,color:"var(--ink3)"}}>{l.stage}</td><td style={{padding:"9px 16px",borderBottom:"1px solid var(--bdr)",fontSize:12}}><span style={{fontSize:11,fontWeight:600,padding:"2px 8px",borderRadius:10,background:(l.daysInStage||0)<30?"#d1fae5":(l.daysInStage||0)<60?"#fef3c7":"#fee2e2",color:(l.daysInStage||0)<30?"#065f46":(l.daysInStage||0)<60?"#92400e":"#b91c1c"}}>{l.daysInStage}d</span></td><td style={{padding:"9px 16px",borderBottom:"1px solid var(--bdr)",fontSize:12,color:"var(--ink2)"}}>{l.owner}</td><td style={{padding:"9px 16px",borderBottom:"1px solid var(--bdr)",fontSize:12,color:"var(--ink3)"}}>{l.lastActivity}</td><td style={{padding:"9px 16px",borderBottom:"1px solid var(--bdr)",fontSize:12}}><a href={`https://app-eu1.hubspot.com/contacts/144061788/contact/${l.id}`} target="_blank" rel="noreferrer" style={{color:"var(--blu)",fontSize:11}}>Open ↗</a></td></tr>))}</tbody></table></div></div></div>)}
          </>)
        })()}
        </div>{/* /old-pipeline-hidden */}

        {/* ── DK Deals ── */}
        <div>

        {/* ─── SECTION 1: DEALS CLOSED ─────────────────────────────────────── */}
        <div style={{padding:"14px 0 6px",borderTop:"3px solid var(--grn)",marginTop:8}}>
          <span style={{fontSize:12,fontWeight:700,letterSpacing:".06em",textTransform:"uppercase",color:"var(--grn)"}}>Deals Closed · Brand Denmark</span>
          <span style={{fontSize:10,color:"var(--ink3)",marginLeft:10}}>Filtered by Close Date · Endavu integration + Sales · all closed deals</span>
        </div>

        {/* Filter bar 1 */}
        <div style={{display:"flex",flexWrap:"wrap",gap:16,padding:"12px 0 12px",alignItems:"flex-end",background:"rgba(21,97,76,.03)",borderRadius:6,paddingLeft:12,paddingRight:12,marginBottom:8}}>
          <div style={{display:"flex",flexDirection:"column",gap:4}}>
            <span style={lblStyle}>Close Date</span>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <input type="date" value={c1From} onChange={e => setC1From(e.target.value)} style={{fontSize:12,padding:"6px 10px",border:"1px solid var(--bdr)",borderRadius:4,fontFamily:"inherit",color:"var(--ink2)",background:"#fff"}} />
              <span style={{color:"var(--ink3)"}}>—</span>
              <input type="date" value={c1To} onChange={e => setC1To(e.target.value)} style={{fontSize:12,padding:"6px 10px",border:"1px solid var(--bdr)",borderRadius:4,fontFamily:"inherit",color:"var(--ink2)",background:"#fff"}} />
            </div>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:4}}>
            <span style={lblStyle}>Pipeline Deal Stage</span>
            <select value={c1Stage} onChange={e => setC1Stage(e.target.value)} style={selStyle}>
              <option value="">All stages</option>
              <option value="Closed Won">Closed Won</option>
              <option value="Closed Lost">Closed Lost</option>
              <option value="Subscription Form Sent">Subscription Form Sent</option>
              <option value="Negotiations">Negotiations</option>
            </select>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:4}}>
            <span style={lblStyle}>Subscription Status</span>
            <select value={c1Status} onChange={e => setC1Status(e.target.value)} style={selStyle}>
              <option value="">All statuses</option>
              {statusOpts.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:4}}>
            <span style={lblStyle}>Pipeline</span>
            <select value={c1Pipeline} onChange={e => setC1Pipeline(e.target.value)} style={selStyle}>
              <option value="">All pipelines</option>
              {pipelineOpts.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:4}}>
            <span style={lblStyle}>Deal Owner</span>
            <select value={c1Owner} onChange={e => setC1Owner(e.target.value)} style={selStyle}>
              <option value="">All owners</option>
              {ownerOpts.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          {hasFilter1 && (
            <button onClick={() => { setC1From(_ytdFrom); setC1To(_ytdTo); setC1Stage(""); setC1Status(""); setC1Pipeline(""); setC1Owner("") }}
              style={{fontSize:11,fontWeight:600,padding:"6px 14px",border:"1px solid var(--bdr)",borderRadius:4,background:"transparent",cursor:"pointer",color:"var(--ink3)",fontFamily:"inherit",alignSelf:"flex-end"}}>
              Clear filter
            </button>
          )}
        </div>

        {closedDealsLoading && (
          <div style={{padding:"14px 16px",fontSize:12,color:"var(--ink3)",background:"rgba(21,97,76,.04)",borderRadius:6,marginTop:8}}>Loading deals from HubSpot…</div>
        )}
        {/* Reports: Closed Won table */}
        <div className="tcard" style={{marginTop:8}}>
          <div className="tcard-head">
            <span className="tcard-title">
              {c1Stage === "Subscription Form Sent" ? "Subscription Form Sent" :
               c1Stage === "Negotiations"           ? "Negotiations" :
               "All Deals Closed Won"} · {(c1From || c1To) ? `${c1From || "..."} — ${c1To || "..."}` : `${new Date().getFullYear()} YTD`}
            </span>
            <span className="tcard-sub">{allWon.length} deals · {fmt(allWonAmt)}</span>
          </div>
          {vnDealTable(allWon, "var(--grn)", isOpenStage ? "created" : "closed", !isOpenStage)}
        </div>
        {/* Reports: Closed Lost table — hidden when an open stage is selected */}
        {!isOpenStage && (
          <div className="tcard" style={{marginTop:8}}>
            <div className="tcard-head">
              <span className="tcard-title">All Deals Closed Lost · {(c1From || c1To) ? `${c1From || "..."} — ${c1To || "..."}` : `${new Date().getFullYear()} YTD`}</span>
              <span className="tcard-sub">{allLost.length} deals · {fmt(allLostAmt)}</span>
            </div>
            {vnDealTable(allLost, "var(--gld)", "closed")}
          </div>
        )}

        {/* ─── PIPELINE RAPPORT ─────────────────────────────────────────────── */}
        <div style={{marginTop:32,padding:"10px 0 6px",borderTop:"2px solid var(--blu)"}}>
          <span style={{fontSize:11,fontWeight:700,letterSpacing:".06em",textTransform:"uppercase",color:"var(--blu)"}}>Pipeline Report · Sales</span>
          <span style={{fontSize:10,color:"var(--ink3)",marginLeft:8}}>All deals · Endavu + Sales + Scrive · all stages · all BU DK pipelines · {new Date().getFullYear()} YTD</span>
        </div>
        {(() => {
          const allSalesDeals = [...rapportNeg, ...rapportSub, ...rapportWon, ...rapportLost]
          const pipelines = [...new Set(allSalesDeals.map((d: any) => d.pipeline).filter((p: string) => p && p !== "—"))].sort()
          if (pipelines.length === 0) return (
            <div style={{padding:"24px",color:"var(--ink3)",fontSize:12,textAlign:"center"}}>No sales deals in YTD data</div>
          )
          const thS = {...th, padding:"8px 14px"}
          const tdS = {...td, padding:"8px 14px", fontSize:11}
          const tdR = {...tdS, textAlign:"right" as const}
          const C_NEG = "var(--blu)";  const BG_NEG = "rgba(45,104,176,.08)"
          const C_SUB = "var(--pur)";  const BG_SUB = "rgba(90,73,152,.08)"
          const C_WON = "var(--grn)";  const BG_WON = "rgba(21,97,76,.08)"
          const C_LOST = "var(--gld)"; const BG_LOST = "rgba(150,128,58,.08)"
          const cell = (arr: any[], color: string, bg: string, title?: string) => (
            <td style={{...tdS,textAlign:"center",background: arr.length > 0 ? bg : "transparent"}}>
              {arr.length > 0
                ? <><span style={{fontWeight:600,color,...(title ? {cursor:"pointer",textDecorationLine:"underline",textDecorationStyle:"dotted"} : {})}} onClick={title ? () => setPipelineModal({title, deals: arr}) : undefined}>{arr.length}</span><br/><span style={{fontSize:10,color:"var(--ink3)"}}>{fmtShort(arr.reduce((s: number,d: any)=>s+d.amount,0))}</span></>
                : <span style={{color:"var(--ink3)"}}>—</span>
              }
            </td>
          )
          const totNeg  = rapportNeg.reduce((s: number,d: any)=>s+d.amount,0)
          const totSub  = rapportSub.reduce((s: number,d: any)=>s+d.amount,0)
          const totWon  = rapportWon.reduce((s: number,d: any)=>s+d.amount,0)
          const totLost = rapportLost.reduce((s: number,d: any)=>s+d.amount,0)
          return (
            <div className="tcard" style={{marginTop:8}}>
              <div style={{overflowX:"auto"}}>
                <table style={{width:"100%",borderCollapse:"collapse"}}>
                  <thead style={{position:"sticky",top:0,background:"var(--bei)",zIndex:1}}>
                    <tr>
                      <th style={thS}>Pipeline</th>
                      <th style={{...thS,textAlign:"center"}}>Negotiations</th>
                      <th style={{...thS,textAlign:"center"}}>Subscription Form Sent</th>
                      <th style={{...thS,textAlign:"center"}}>Closed Won</th>
                      <th style={{...thS,textAlign:"center"}}>Closed Lost</th>
                      <th style={{...thS,textAlign:"right",color:C_WON}}>Total Won</th>
                      <th style={{...thS,textAlign:"right",color:C_LOST}}>Total Lost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pipelines.map((pl: string) => {
                      const neg  = rapportNeg.filter((d: any) => d.pipeline === pl)
                      const sub  = rapportSub.filter((d: any) => d.pipeline === pl)
                      const won  = rapportWon.filter((d: any) => d.pipeline === pl)
                      const lost = rapportLost.filter((d: any) => d.pipeline === pl)
                      const wAmt = won.reduce((s: number,d: any)=>s+d.amount,0)
                      const lAmt = lost.reduce((s: number,d: any)=>s+d.amount,0)
                      return (
                        <tr key={pl}>
                          <td style={{...tdS,fontWeight:600,color:"var(--ink2)"}}>{pl}</td>
                          {cell(neg,  C_NEG,  BG_NEG)}
                          {cell(sub,  C_SUB,  BG_SUB)}
                          {cell(won,  C_WON,  BG_WON,  `Closed Won · ${pl}`)}
                          {cell(lost, C_LOST, BG_LOST, `Closed Lost · ${pl}`)}
                          <td style={{...tdR,fontWeight:600,color:C_WON}}>{wAmt > 0 ? fmt(wAmt) : "—"}</td>
                          <td style={{...tdR,fontWeight:600,color:C_LOST}}>{lAmt > 0 ? fmt(lAmt) : "—"}</td>
                        </tr>
                      )
                    })}
                    <tr style={{borderTop:"2px solid var(--bdr)",background:"rgba(18,20,40,.02)"}}>
                      <td style={{...tdS,fontWeight:700,color:"var(--ink1)"}}>Total</td>
                      <td style={{...tdS,textAlign:"center",fontWeight:700}}>{rapportNeg.length > 0 ? <><span style={{color:C_NEG}}>{rapportNeg.length}</span><br/><span style={{fontSize:10,color:"var(--ink3)"}}>{fmtShort(totNeg)}</span></> : "—"}</td>
                      <td style={{...tdS,textAlign:"center",fontWeight:700}}>{rapportSub.length > 0 ? <><span style={{color:C_SUB}}>{rapportSub.length}</span><br/><span style={{fontSize:10,color:"var(--ink3)"}}>{fmtShort(totSub)}</span></> : "—"}</td>
                      <td style={{...tdS,textAlign:"center",fontWeight:700}}>{rapportWon.length > 0 ? <><span style={{color:C_WON,cursor:"pointer",textDecorationLine:"underline",textDecorationStyle:"dotted"}} onClick={() => setPipelineModal({title:"Closed Won · All Pipelines", deals: rapportWon})}>{rapportWon.length}</span><br/><span style={{fontSize:10,color:"var(--ink3)"}}>{fmtShort(totWon)}</span></> : "—"}</td>
                      <td style={{...tdS,textAlign:"center",fontWeight:700}}>{rapportLost.length > 0 ? <><span style={{color:C_LOST,cursor:"pointer",textDecorationLine:"underline",textDecorationStyle:"dotted"}} onClick={() => setPipelineModal({title:"Closed Lost · All Pipelines", deals: rapportLost})}>{rapportLost.length}</span><br/><span style={{fontSize:10,color:"var(--ink3)"}}>{fmtShort(totLost)}</span></> : "—"}</td>
                      <td style={{...tdR,fontWeight:700,color:C_WON}}>{fmt(totWon)}</td>
                      <td style={{...tdR,fontWeight:700,color:C_LOST}}>{fmt(totLost)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )
        })()}


        {/* ─── CLOSED DEALS REPORT · CLOSE DATE FILTER ─────────────────────── */}
        <div style={{marginTop:32,padding:"10px 0 6px",borderTop:"2px solid var(--grn)"}}>
          <span style={{fontSize:11,fontWeight:700,letterSpacing:".06em",textTransform:"uppercase",color:"var(--grn)"}}>Closed Deals Report · Custom Period</span>
          <span style={{fontSize:10,color:"var(--ink3)",marginLeft:8}}>Closed Won + Closed Lost · all BU DK pipelines · filtered by close date</span>
        </div>
        <div style={{display:"flex",flexWrap:"wrap",gap:16,padding:"12px",alignItems:"flex-end",background:"rgba(21,97,76,.04)",borderRadius:6,marginBottom:8}}>
          <div style={{display:"flex",flexDirection:"column",gap:4}}>
            <span style={lblStyle}>Close Date Range</span>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <input type="date" value={prFrom} onChange={e => setPrFrom(e.target.value)} style={{fontSize:12,padding:"6px 10px",border:"1px solid var(--bdr)",borderRadius:4,fontFamily:"inherit",color:"var(--ink2)",background:"#fff"}} />
              <span style={{color:"var(--ink3)"}}>—</span>
              <input type="date" value={prTo} onChange={e => setPrTo(e.target.value)} style={{fontSize:12,padding:"6px 10px",border:"1px solid var(--bdr)",borderRadius:4,fontFamily:"inherit",color:"var(--ink2)",background:"#fff"}} />
              {(prFrom || prTo) && <button onClick={() => { setPrFrom(""); setPrTo("") }} style={{fontSize:11,padding:"6px 12px",border:"1px solid var(--bdr)",borderRadius:4,background:"transparent",cursor:"pointer",color:"var(--ink3)",fontFamily:"inherit"}}>Clear</button>}
              {prLoading && <span style={{fontSize:11,color:"var(--ink3)"}}>Loading…</span>}
            </div>
          </div>
        </div>
        {(() => {
          const cdWon  = (prDeals ? prDeals.won  : rapportWon ) as any[]
          const cdLost = (prDeals ? prDeals.lost : rapportLost) as any[]
          // Use all four rapport arrays so every known DK pipeline shows as a row even with 0 deals in the period
          const pipelines = [...new Set([...rapportNeg, ...rapportSub, ...rapportWon, ...rapportLost].map((d: any) => d.pipeline).filter((p: string) => p && p !== "—"))].sort()
          const label = (prFrom || prTo) ? `${prFrom || "…"} — ${prTo || "…"}` : `${new Date().getFullYear()} YTD`
          if (pipelines.length === 0) return (
            <div style={{padding:"24px",color:"var(--ink3)",fontSize:12,textAlign:"center"}}>{(prFrom || prTo) ? "No closed deals found for this period" : "No closed deals in YTD data"}</div>
          )
          const thS = {...th, padding:"8px 14px"}
          const tdS = {...td, padding:"8px 14px", fontSize:11}
          const tdR = {...tdS, textAlign:"right" as const}
          const C_WON = "var(--grn)";  const BG_WON = "rgba(21,97,76,.08)"
          const C_LOST = "var(--gld)"; const BG_LOST = "rgba(150,128,58,.08)"
          const cell = (arr: any[], color: string, bg: string, title?: string) => (
            <td style={{...tdS,textAlign:"center",background: arr.length > 0 ? bg : "transparent"}}>
              {arr.length > 0
                ? <><span style={{fontWeight:600,color,...(title ? {cursor:"pointer",textDecorationLine:"underline",textDecorationStyle:"dotted"} : {})}} onClick={title ? () => setPipelineModal({title, deals: arr}) : undefined}>{arr.length}</span><br/><span style={{fontSize:10,color:"var(--ink3)"}}>{fmtShort(arr.reduce((s: number,d: any)=>s+d.amount,0))}</span></>
                : <span style={{color:"var(--ink3)"}}>—</span>}
            </td>
          )
          const totWon  = cdWon.reduce((s: number,d: any)=>s+d.amount,0)
          const totLost = cdLost.reduce((s: number,d: any)=>s+d.amount,0)
          return (
            <div className="tcard" style={{marginTop:8}}>
              <div style={{padding:"8px 14px 4px",fontSize:10,color:"var(--ink3)"}}>Period: <strong style={{color:"var(--ink2)"}}>{label}</strong>{prDeals && <span style={{marginLeft:8,color:"var(--grn)"}}>● live</span>}</div>
              <div style={{overflowX:"auto"}}>
                <table style={{width:"100%",borderCollapse:"collapse"}}>
                  <thead style={{position:"sticky",top:0,background:"var(--bei)",zIndex:1}}>
                    <tr>
                      <th style={thS}>Pipeline</th>
                      <th style={{...thS,textAlign:"center",color:C_WON}}>Closed Won</th>
                      <th style={{...thS,textAlign:"center",color:C_LOST}}>Closed Lost</th>
                      <th style={{...thS,textAlign:"right",color:C_WON}}>Total Won</th>
                      <th style={{...thS,textAlign:"right",color:C_LOST}}>Total Lost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pipelines.map((pl: string) => {
                      const won  = cdWon.filter((d: any) => d.pipeline === pl)
                      const lost = cdLost.filter((d: any) => d.pipeline === pl)
                      const wAmt = won.reduce((s: number,d: any)=>s+d.amount,0)
                      const lAmt = lost.reduce((s: number,d: any)=>s+d.amount,0)
                      return (
                        <tr key={pl}>
                          <td style={{...tdS,fontWeight:600,color:"var(--ink2)"}}>{pl}</td>
                          {cell(won,  C_WON,  BG_WON,  `Closed Won · ${pl}`)}
                          {cell(lost, C_LOST, BG_LOST, `Closed Lost · ${pl}`)}
                          <td style={{...tdR,fontWeight:600,color:C_WON}}>{wAmt > 0 ? fmt(wAmt) : "—"}</td>
                          <td style={{...tdR,fontWeight:600,color:C_LOST}}>{lAmt > 0 ? fmt(lAmt) : "—"}</td>
                        </tr>
                      )
                    })}
                    <tr style={{borderTop:"2px solid var(--bdr)",background:"rgba(18,20,40,.02)"}}>
                      <td style={{...tdS,fontWeight:700,color:"var(--ink1)"}}>Total</td>
                      <td style={{...tdS,textAlign:"center",fontWeight:700}}>{cdWon.length > 0 ? <><span style={{color:C_WON,cursor:"pointer",textDecorationLine:"underline",textDecorationStyle:"dotted"}} onClick={() => setPipelineModal({title:"Closed Won · All Pipelines", deals: cdWon})}>{cdWon.length}</span><br/><span style={{fontSize:10,color:"var(--ink3)"}}>{fmtShort(totWon)}</span></> : "—"}</td>
                      <td style={{...tdS,textAlign:"center",fontWeight:700}}>{cdLost.length > 0 ? <><span style={{color:C_LOST,cursor:"pointer",textDecorationLine:"underline",textDecorationStyle:"dotted"}} onClick={() => setPipelineModal({title:"Closed Lost · All Pipelines", deals: cdLost})}>{cdLost.length}</span><br/><span style={{fontSize:10,color:"var(--ink3)"}}>{fmtShort(totLost)}</span></> : "—"}</td>
                      <td style={{...tdR,fontWeight:700,color:C_WON}}>{fmt(totWon)}</td>
                      <td style={{...tdR,fontWeight:700,color:C_LOST}}>{fmt(totLost)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )
        })()}

        {/* ─── PIPELINE ACTIVITY REPORT · CREATE DATE FILTER ───────────────── */}
        <div style={{marginTop:32,padding:"10px 0 6px",borderTop:"2px solid var(--blu)"}}>
          <span style={{fontSize:11,fontWeight:700,letterSpacing:".06em",textTransform:"uppercase",color:"var(--blu)"}}>Pipeline Activity Report · Custom Period</span>
          <span style={{fontSize:10,color:"var(--ink3)",marginLeft:8}}>Negotiations + Subscription Form Sent · all BU DK pipelines · filtered by create date</span>
        </div>
        <div style={{display:"flex",flexWrap:"wrap",gap:16,padding:"12px",alignItems:"flex-end",background:"rgba(45,104,176,.04)",borderRadius:6,marginBottom:8}}>
          <div style={{display:"flex",flexDirection:"column",gap:4}}>
            <span style={lblStyle}>Create Date Range</span>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <input type="date" value={paFrom} onChange={e => setPaFrom(e.target.value)} style={{fontSize:12,padding:"6px 10px",border:"1px solid var(--bdr)",borderRadius:4,fontFamily:"inherit",color:"var(--ink2)",background:"#fff"}} />
              <span style={{color:"var(--ink3)"}}>—</span>
              <input type="date" value={paTo} onChange={e => setPaTo(e.target.value)} style={{fontSize:12,padding:"6px 10px",border:"1px solid var(--bdr)",borderRadius:4,fontFamily:"inherit",color:"var(--ink2)",background:"#fff"}} />
              {(paFrom || paTo) && <button onClick={() => { setPaFrom(""); setPaTo("") }} style={{fontSize:11,padding:"6px 12px",border:"1px solid var(--bdr)",borderRadius:4,background:"transparent",cursor:"pointer",color:"var(--ink3)",fontFamily:"inherit"}}>Clear</button>}
            </div>
          </div>
        </div>
        {(() => {
          const filterByCreate = (items: any[]) => items.filter((d: any) => {
            if (paFrom && d.createdate && new Date(d.createdate).getTime() < new Date(paFrom).getTime()) return false
            if (paTo   && d.createdate && new Date(d.createdate).getTime() > new Date(paTo + "T23:59:59").getTime()) return false
            return true
          })
          const paNeg = (paFrom || paTo) ? filterByCreate(rapportNeg) : rapportNeg
          const paSub = (paFrom || paTo) ? filterByCreate(rapportSub) : rapportSub
          // Use all four rapport arrays so every known DK pipeline shows as a row even with 0 activity in the period
          const pipelines = [...new Set([...rapportNeg, ...rapportSub, ...rapportWon, ...rapportLost].map((d: any) => d.pipeline).filter((p: string) => p && p !== "—"))].sort()
          const label = (paFrom || paTo) ? `${paFrom || "…"} — ${paTo || "…"}` : `${new Date().getFullYear()} YTD`
          if (pipelines.length === 0) return (
            <div style={{padding:"24px",color:"var(--ink3)",fontSize:12,textAlign:"center"}}>{(paFrom || paTo) ? "No open deals found for this period" : "No open deals in YTD data"}</div>
          )
          const thS = {...th, padding:"8px 14px"}
          const tdS = {...td, padding:"8px 14px", fontSize:11}
          const tdR = {...tdS, textAlign:"right" as const}
          const C_NEG = "var(--blu)"; const BG_NEG = "rgba(45,104,176,.08)"
          const C_SUB = "var(--pur)"; const BG_SUB = "rgba(90,73,152,.08)"
          const cell = (arr: any[], color: string, bg: string, title?: string) => (
            <td style={{...tdS,textAlign:"center",background: arr.length > 0 ? bg : "transparent"}}>
              {arr.length > 0
                ? <><span style={{fontWeight:600,color,...(title ? {cursor:"pointer",textDecorationLine:"underline",textDecorationStyle:"dotted"} : {})}} onClick={title ? () => setPipelineModal({title, deals: arr}) : undefined}>{arr.length}</span><br/><span style={{fontSize:10,color:"var(--ink3)"}}>{fmtShort(arr.reduce((s: number,d: any)=>s+d.amount,0))}</span></>
                : <span style={{color:"var(--ink3)"}}>—</span>}
            </td>
          )
          const totNeg = paNeg.reduce((s: number,d: any)=>s+d.amount,0)
          const totSub = paSub.reduce((s: number,d: any)=>s+d.amount,0)
          return (
            <div className="tcard" style={{marginTop:8}}>
              <div style={{padding:"8px 14px 4px",fontSize:10,color:"var(--ink3)"}}>Period: <strong style={{color:"var(--ink2)"}}>{label}</strong></div>
              <div style={{overflowX:"auto"}}>
                <table style={{width:"100%",borderCollapse:"collapse"}}>
                  <thead style={{position:"sticky",top:0,background:"var(--bei)",zIndex:1}}>
                    <tr>
                      <th style={thS}>Pipeline</th>
                      <th style={{...thS,textAlign:"center",color:C_NEG}}>Negotiations</th>
                      <th style={{...thS,textAlign:"center",color:C_SUB}}>Subscription Form Sent</th>
                      <th style={{...thS,textAlign:"right",color:C_NEG}}>Total Neg.</th>
                      <th style={{...thS,textAlign:"right",color:C_SUB}}>Total Sub.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pipelines.map((pl: string) => {
                      const neg = paNeg.filter((d: any) => d.pipeline === pl)
                      const sub = paSub.filter((d: any) => d.pipeline === pl)
                      const nAmt = neg.reduce((s: number,d: any)=>s+d.amount,0)
                      const sAmt = sub.reduce((s: number,d: any)=>s+d.amount,0)
                      return (
                        <tr key={pl}>
                          <td style={{...tdS,fontWeight:600,color:"var(--ink2)"}}>{pl}</td>
                          {cell(neg, C_NEG, BG_NEG, `Negotiations · ${pl}`)}
                          {cell(sub, C_SUB, BG_SUB, `Subscription Form Sent · ${pl}`)}
                          <td style={{...tdR,fontWeight:600,color:C_NEG}}>{nAmt > 0 ? fmt(nAmt) : "—"}</td>
                          <td style={{...tdR,fontWeight:600,color:C_SUB}}>{sAmt > 0 ? fmt(sAmt) : "—"}</td>
                        </tr>
                      )
                    })}
                    <tr style={{borderTop:"2px solid var(--bdr)",background:"rgba(18,20,40,.02)"}}>
                      <td style={{...tdS,fontWeight:700,color:"var(--ink1)"}}>Total</td>
                      <td style={{...tdS,textAlign:"center",fontWeight:700}}>{paNeg.length > 0 ? <><span style={{color:C_NEG,cursor:"pointer",textDecorationLine:"underline",textDecorationStyle:"dotted"}} onClick={() => setPipelineModal({title:"Negotiations · All Pipelines", deals: paNeg})}>{paNeg.length}</span><br/><span style={{fontSize:10,color:"var(--ink3)"}}>{fmtShort(totNeg)}</span></> : "—"}</td>
                      <td style={{...tdS,textAlign:"center",fontWeight:700}}>{paSub.length > 0 ? <><span style={{color:C_SUB,cursor:"pointer",textDecorationLine:"underline",textDecorationStyle:"dotted"}} onClick={() => setPipelineModal({title:"Subscription Form Sent · All Pipelines", deals: paSub})}>{paSub.length}</span><br/><span style={{fontSize:10,color:"var(--ink3)"}}>{fmtShort(totSub)}</span></> : "—"}</td>
                      <td style={{...tdR,fontWeight:700,color:C_NEG}}>{fmt(totNeg)}</td>
                      <td style={{...tdR,fontWeight:700,color:C_SUB}}>{fmt(totSub)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )
        })()}

        <div className="lbl" style={{marginTop:40}}><span className="lbl-text">Fund subscription funnel · Since launch</span></div>
        <div className="g4">
          <div className="kpi c-blu">
            <div className="kpi-lbl">Under subscription</div>
            <div className="kpi-val sm">{data?.funnel.created} deals</div>
            <div className="kpi-sub">Open endavu deals · documents missing</div>
            <div style={{marginTop:10,fontSize:14,fontWeight:700,color:"var(--blu)"}}>{fmtShort(data?.funnel.pendingAmount??0)}</div>
            <div style={{fontSize:10,color:"var(--ink3)"}}>expected signed amount</div>
          </div>
          <div className="kpi c-grn">
            <div className="kpi-lbl">Signed</div>
            <div className="kpi-val">{data?.funnel.signed}</div>
            <div className="kpi-sub">{fmt(data?.seller.vn.amount??0)}</div>
          </div>
          <div className="kpi c-gld">
            <div className="kpi-lbl">Lost</div>
            <div className="kpi-val">{data?.funnel.cancelled}</div>
          </div>
          <div className="kpi c-pur">
            <div className="kpi-lbl">Conversion rate</div>
            <div className="kpi-val sm">{Math.round((data?.funnel.signed??0)/((data?.funnel.signed??0)+(data?.funnel.cancelled??1))*100)}%</div>
            <div className="kpi-sub">Won / (Won + Lost) · {data?.funnel.signed} af {(data?.funnel.signed??0)+(data?.funnel.cancelled??0)}</div>
          </div>
        </div>

        {(data?.fundsPending?.length ?? 0) > 0 && (
          <div className="mt">
            <div className="tcard">
              <div className="tcard-head">
                <span className="tcard-title">Open subscriptions · under signing · VaekstNet</span>
                <span className="tcard-sub">Documents missing · {fmtShort(data?.funnel.pendingAmount??0)} total expected</span>
              </div>
              <table style={{width:"100%",borderCollapse:"collapse"}}>
                <thead><tr>
                  <th style={th}>#</th>
                  <th style={th}>Fund</th>
                  <th style={th}>Open deals</th>
                  <th style={{...th,textAlign:"right"}}>Expected amount</th>
                </tr></thead>
                <tbody>
                  {data?.fundsPending.flatMap((f: any,i: number) => {
                    const rows = [(
                      <tr key={f.name} onClick={() => setExpandedFundPending(expandedFundPending === f.name ? null : f.name)} style={{cursor:"pointer"}}>
                        <td style={td}><span className="rank">{i+1}</span></td>
                        <td style={td}><div style={{fontWeight:500}}>{f.name}</div><div className="bar-bg"><div className="bar-fill" style={{width:`${Math.round(f.amount/maxPending*100)}%`,background:"var(--blu)"}}/></div></td>
                        <td style={td}>{f.deals}</td>
                        <td style={{...td,color:"var(--blu)",fontWeight:600,textAlign:"right"}}>{fmt(f.amount)} {expandedFundPending === f.name ? "▲" : "▼"}</td>
                      </tr>
                    )]
                    if (expandedFundPending === f.name) {
                      rows.push(
                        <tr key={f.name+"_d"}>
                          <td colSpan={4} style={{padding:"8px 16px 12px",background:"var(--bei)",borderBottom:"1px solid var(--bdr)"}}>
                            <div style={{display:"flex",flexDirection:"column",gap:4}}>
                              {f.dealList?.sort((a: any,b: any) => b.amount - a.amount).map((d: any) => (
                                <a key={d.id} href={`https://app-eu1.hubspot.com/contacts/${PORTAL}/record/0-3/${d.id}`} target="_blank" rel="noreferrer"
                                  style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 10px",background:"#fff",borderRadius:4,border:"1px solid var(--bdr)",textDecoration:"none",fontSize:11,color:"var(--ink2)"}}>
                                  <span style={{flex:1}}>{d.name}</span>
                                  <span style={{color:"var(--ink3)",fontSize:10,marginRight:12}}>{d.owner || "—"}</span>
                                  <span style={{fontWeight:600,color:"var(--blu)"}}>{fmt(d.amount)}</span>
                                </a>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )
                    }
                    return rows
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
        </div>{/* /deals-1 */}


        <div style={{display: tab==="deals" ? "" : "none"}}>
        <div className="lbl"><span className="lbl-text">Seller performance · DK · 2026 YTD</span></div>
        <div className="g4" style={{marginBottom:12}}>
          <div className="kpi c-grn" style={{gridColumn:"span 2"}}>
            <div className="kpi-lbl">Total signed via Scrive · DK</div>
            <div className="kpi-val xsm">{fmt(data?.seller.scriveDk.amount??0)}</div>
            <div className="kpi-sub">{data?.seller.scriveDk.deals} deals · closed_won · 2026 YTD</div>
          </div>
          <div className="kpi c-ink">
            <div className="kpi-lbl">Under signing · Scrive DK</div>
            <div className="kpi-val sm">{data?.seller.scriveDk.pendingDeals} deals</div>
            <div className="kpi-sub" style={{color:"var(--blu)",fontWeight:600}}>{fmtShort(data?.seller.scriveDk.pendingAmount??0)} expected</div>
          </div>
          <div className="kpi c-ink">
            <div className="kpi-lbl">Avg. deal · Scrive DK</div>
            <div className="kpi-val sm">{fmtShort((data?.seller.scriveDk.amount??0)/(data?.seller.scriveDk.deals||1))}</div>
          </div>
        </div>
        <div className="g4" style={{marginBottom:24}}>
          <div className="kpi c-pur" style={{gridColumn:"span 2"}}>
            <div className="kpi-lbl">Total signed via VaekstNet</div>
            <div className="kpi-val xsm">{fmt(data?.seller.vn.amount??0)}</div>
            <div className="kpi-sub">{data?.seller.vn.deals} deals · closed_won</div>
          </div>
          <div className="kpi c-ink">
            <div className="kpi-lbl">Under signing · VaekstNet</div>
            <div className="kpi-val sm">{data?.seller.vn.pendingDeals} deals</div>
            <div className="kpi-sub" style={{color:"var(--blu)",fontWeight:600}}>{fmtShort(data?.seller.vn.pendingAmount??0)} expected</div>
          </div>
          <div className="kpi c-gld">
            <div className="kpi-lbl">Total pipeline · DK</div>
            <div className="kpi-val sm">{fmtShort((data?.seller.vn.pendingAmount??0)+(data?.seller.scriveDk.pendingAmount??0))}</div>
            <div className="kpi-sub">VN + Scrive · under signing</div>
          </div>
        </div>

        <div className="g11">
          <div className="tcard">
            <div className="tcard-head"><span className="tcard-title">Via Scrive · DK</span><span className="tcard-sub">closed_won · 2026 YTD</span></div>
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead><tr>
                <th style={th}>#</th>
                <th style={th}>Seller</th>
                <th style={th}>Deals</th>
                <th style={{...th,textAlign:"right"}}>Signed</th>
              </tr></thead>
              <tbody>
                {data?.seller.scriveSellers.slice(0,10).flatMap((s: any,i: number) => {
                  const rows = [(
                    <tr key={s.name} onClick={() => setExpandedScrive(expandedScrive === s.name ? null : s.name)} style={{cursor:"pointer"}}>
                      <td style={td}><span className="rank">{i+1}</span></td>
                      <td style={td}>
                        <div style={{fontWeight:500}}>{s.name}</div>
                        <div className="bar-bg"><div className="bar-fill" style={{width:`${Math.round(s.amount/maxScrive*100)}%`,background:C.G}}/></div>
                      </td>
                      <td style={td}>{s.deals}</td>
                      <td style={{...td,color:C.G,fontWeight:600,textAlign:"right"}}>
                        {fmt(s.amount)} {expandedScrive === s.name ? "▲" : "▼"}
                      </td>
                    </tr>
                  )]
                  if (expandedScrive === s.name) {
                    rows.push(
                      <tr key={s.name+"_d"}>
                        <td colSpan={4} style={{padding:"8px 16px 12px",background:"var(--bei)",borderBottom:"1px solid var(--bdr)"}}>
                          <div style={{display:"flex",flexDirection:"column",gap:4}}>
                            {s.dealList?.sort((a: any,b: any) => b.amount - a.amount).map((d: any) => (
                              <a key={d.id} href={`https://app-eu1.hubspot.com/contacts/${PORTAL}/record/0-3/${d.id}`} target="_blank" rel="noreferrer"
                                style={{display:"flex",justifyContent:"space-between",padding:"6px 10px",background:"#fff",borderRadius:4,border:"1px solid var(--bdr)",textDecoration:"none",fontSize:11,color:"var(--ink2)"}}>
                                <span>{d.name}</span>
                                <span style={{fontWeight:600,color:C.G}}>{fmt(d.amount)}</span>
                              </a>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )
                  }
                  return rows
                })}
              </tbody>
            </table>
          </div>
          <div className="tcard">
            <div className="tcard-head"><span className="tcard-title">Via VaekstNet</span><span className="tcard-sub">closed_won · Since launch</span></div>
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead><tr>
                <th style={th}>#</th>
                <th style={th}>Seller</th>
                <th style={th}>Deals</th>
                <th style={{...th,textAlign:"right"}}>Signed</th>
              </tr></thead>
              <tbody>
                {data?.seller.vnSellers?.flatMap((s: any,i: number) => {
                  const rows = [(
                    <tr key={s.name} onClick={() => setExpandedVn(expandedVn === s.name ? null : s.name)} style={{cursor:"pointer"}}>
                      <td style={td}><span className="rank">{i+1}</span></td>
                      <td style={td}>
                        <div style={{fontWeight:500}}>{s.name}</div>
                        <div className="bar-bg"><div className="bar-fill" style={{width:`${Math.round(s.amount/maxVn*100)}%`,background:C.P}}/></div>
                      </td>
                      <td style={td}>{s.deals}</td>
                      <td style={{...td,color:C.P,fontWeight:600,textAlign:"right"}}>
                        {fmt(s.amount)} {expandedVn === s.name ? "▲" : "▼"}
                      </td>
                    </tr>
                  )]
                  if (expandedVn === s.name) {
                    rows.push(
                      <tr key={s.name+"_d"}>
                        <td colSpan={4} style={{padding:"8px 16px 12px",background:"var(--bei)",borderBottom:"1px solid var(--bdr)"}}>
                          <div style={{display:"flex",flexDirection:"column",gap:4}}>
                            {s.dealList?.sort((a: any,b: any) => b.amount - a.amount).map((d: any) => (
                              <a key={d.id} href={`https://app-eu1.hubspot.com/contacts/${PORTAL}/record/0-3/${d.id}`} target="_blank" rel="noreferrer"
                                style={{display:"flex",justifyContent:"space-between",padding:"6px 10px",background:"#fff",borderRadius:4,border:"1px solid var(--bdr)",textDecoration:"none",fontSize:11,color:"var(--ink2)"}}>
                                <span>{d.name}</span>
                                <span style={{fontWeight:600,color:C.P}}>{fmt(d.amount)}</span>
                              </a>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )
                  }
                  return rows
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="g2 mt">
          <div className="cc">
            <div className="cc-head"><div><div className="cc-title">Signed per seller · Scrive DK</div><div className="cc-sub">2026 YTD · top 7</div></div></div>
            <canvas id="c6" width={620} height={200} style={{maxWidth:"100%"}}/>
          </div>
          <div className="cc">
            <div className="cc-head"><div><div className="cc-title">Deals per month · Scrive DK</div><div className="cc-sub">closed_won · 2026 YTD</div></div></div>
            <canvas id="c7" width={620} height={200} style={{maxWidth:"100%"}}/>
          </div>
        </div>

        {/* ─── FUND BREAKDOWN WITH DATE FILTER ──────────────────────────────── */}
        <div style={{marginTop:32,padding:"10px 0 6px",borderTop:"2px solid var(--pur)"}}>
          <span style={{fontSize:11,fontWeight:700,letterSpacing:".06em",textTransform:"uppercase",color:"var(--pur)"}}>Signed per fund · Close Date filter</span>
          <span style={{fontSize:10,color:"var(--ink3)",marginLeft:8}}>Filter by close date to view Scrive DK &amp; VaekstNet fund totals for any period</span>
        </div>

        {/* Date filter + KPI totals */}
        <div style={{display:"flex",flexWrap:"wrap",gap:16,padding:"12px",alignItems:"flex-end",background:"rgba(90,73,152,.04)",borderRadius:6,marginTop:8,marginBottom:12}}>
          <div style={{display:"flex",flexDirection:"column",gap:4}}>
            <span style={lblStyle}>Close Date</span>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <input type="date" value={fundDateFrom} onChange={e => setFundDateFrom(e.target.value)} style={{fontSize:12,padding:"6px 10px",border:"1px solid var(--bdr)",borderRadius:4,fontFamily:"inherit",color:"var(--ink2)",background:"#fff"}} />
              <span style={{color:"var(--ink3)"}}>—</span>
              <input type="date" value={fundDateTo} onChange={e => setFundDateTo(e.target.value)} style={{fontSize:12,padding:"6px 10px",border:"1px solid var(--bdr)",borderRadius:4,fontFamily:"inherit",color:"var(--ink2)",background:"#fff"}} />
            </div>
          </div>
          {(fundDateFrom || fundDateTo) && (
            <button onClick={() => { setFundDateFrom(""); setFundDateTo(""); setExpandedScriveFund(null); setExpandedFundSigned(null) }}
              style={{fontSize:11,fontWeight:600,padding:"6px 14px",border:"1px solid var(--bdr)",borderRadius:4,background:"transparent",cursor:"pointer",color:"var(--ink3)",fontFamily:"inherit",alignSelf:"flex-end"}}>
              Clear filter
            </button>
          )}
          {fundDateLoading && <span style={{fontSize:11,color:"var(--ink3)",alignSelf:"flex-end",paddingBottom:6}}>Loading…</span>}
        </div>

        {/* KPI summary cards */}
        <div className="g4" style={{marginBottom:20}}>
          <div className="kpi c-grn" style={{gridColumn:"span 2"}}>
            <div className="kpi-lbl">Total signed · Scrive DK</div>
            <div className="kpi-val xsm">{fmt(fundScriveTotals.amount)}</div>
            <div className="kpi-sub">
              {fundScriveTotals.deals} deals · closed_won
              {fundDateLabel ? ` · ${fundDateLabel}` : " · 2026 YTD"}
            </div>
          </div>
          <div className="kpi c-pur" style={{gridColumn:"span 2"}}>
            <div className="kpi-lbl">Total signed · VaekstNet</div>
            <div className="kpi-val xsm">{fmt(fundVnTotals.amount)}</div>
            <div className="kpi-sub">
              {fundVnTotals.deals} deals · closed_won
              {fundDateLabel ? ` · ${fundDateLabel}` : " · Since launch"}
            </div>
          </div>
          <div className="kpi c-gld" style={{gridColumn:"span 2"}}>
            <div className="kpi-lbl">Combined total</div>
            <div className="kpi-val xsm">{fmt(fundScriveTotals.amount + fundVnTotals.amount)}</div>
            <div className="kpi-sub">{fundScriveTotals.deals + fundVnTotals.deals} deals · Scrive DK + VaekstNet</div>
          </div>
          <div className="kpi c-ink" style={{gridColumn:"span 2"}}>
            <div className="kpi-lbl">Avg. deal size</div>
            <div className="kpi-val sm">{fmtShort((fundScriveTotals.amount + fundVnTotals.amount) / ((fundScriveTotals.deals + fundVnTotals.deals) || 1))}</div>
            <div className="kpi-sub">combined avg. per deal</div>
          </div>
        </div>

        {/* Scrive DK fund breakdown table */}
        <div className="lbl"><span className="lbl-text">Signed per fund · Scrive DK{fundDateLabel ? ` · ${fundDateLabel}` : " · 2026 YTD"}</span></div>
        <div className="g2 mt">
          <div className="tcard">
            <div className="tcard-head">
              <span className="tcard-title">Distribution per fund · Scrive DK</span>
              <span className="tcard-sub">closed_won · {fundDateLabel ?? "2026 YTD"} · {fmt(fundScriveTotals.amount)}</span>
            </div>
            {fundDateLoading ? (
              <div style={{padding:"24px",textAlign:"center",color:"var(--ink3)",fontSize:12}}>Loading…</div>
            ) : activeFundsScrive.length > 0 ? (
              <table style={{width:"100%",borderCollapse:"collapse"}}>
                <thead><tr>
                  <th style={th}>#</th>
                  <th style={th}>Fund</th>
                  <th style={th}>Deals</th>
                  <th style={{...th,textAlign:"right"}}>Signed investment</th>
                </tr></thead>
                <tbody>
                  {activeFundsScrive.flatMap((f: any, i: number) => {
                    const rows = [(
                      <tr key={f.name} onClick={() => setExpandedScriveFund(expandedScriveFund === f.name ? null : f.name)} style={{cursor:"pointer"}}>
                        <td style={td}><span className="rank">{i+1}</span></td>
                        <td style={td}><div style={{fontWeight:500}}>{f.name}</div><div className="bar-bg"><div className="bar-fill" style={{width:`${Math.round(f.amount/maxActiveFundScrive*100)}%`,background:C.G}}/></div></td>
                        <td style={td}>{f.deals}</td>
                        <td style={{...td,color:C.G,fontWeight:600,textAlign:"right"}}>{fmt(f.amount)} {expandedScriveFund === f.name ? "▲" : "▼"}</td>
                      </tr>
                    )]
                    if (expandedScriveFund === f.name) {
                      rows.push(
                        <tr key={f.name+"_d"}>
                          <td colSpan={4} style={{padding:"8px 16px 12px",background:"var(--bei)",borderBottom:"1px solid var(--bdr)"}}>
                            <div style={{display:"flex",flexDirection:"column",gap:4}}>
                              {f.dealList?.sort((a: any,b: any) => b.amount - a.amount).map((d: any) => (
                                <a key={d.id} href={`https://app-eu1.hubspot.com/contacts/${PORTAL}/record/0-3/${d.id}`} target="_blank" rel="noreferrer"
                                  style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 10px",background:"#fff",borderRadius:4,border:"1px solid var(--bdr)",textDecoration:"none",fontSize:11,color:"var(--ink2)"}}>
                                  <span style={{flex:1}}>{d.name}</span>
                                  <span style={{color:"var(--ink3)",fontSize:10,marginRight:12}}>{d.owner || "—"}</span>
                                  <span style={{fontWeight:600,color:C.G}}>{fmt(d.amount)}</span>
                                </a>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )
                    }
                    return rows
                  })}
                </tbody>
              </table>
            ) : (
              <div style={{padding:"24px",textAlign:"center",color:"var(--ink3)",fontSize:12}}>No deals in this date range</div>
            )}
          </div>
          <div className="cc">
            <div className="cc-head"><div><div className="cc-title">Distribution per fund · Scrive DK</div><div className="cc-sub">Signed amount · closed_won · {fundDateLabel ?? "2026 YTD"}</div></div></div>
            <canvas id="c9" width={380} height={200} style={{maxWidth:"100%"}}/>
          </div>
        </div>

        {/* VaekstNet fund breakdown table */}
        <div className="lbl"><span className="lbl-text">Signed per fund · VaekstNet{fundDateLabel ? ` · ${fundDateLabel}` : " · Since launch"}</span></div>
        <div className="g2 mt">
          <div className="tcard">
            <div className="tcard-head">
              <span className="tcard-title">Distribution per fund · VaekstNet</span>
              <span className="tcard-sub">closed_won · {fundDateLabel ?? "Since launch"} · {fmt(fundVnTotals.amount)}</span>
            </div>
            {fundDateLoading ? (
              <div style={{padding:"24px",textAlign:"center",color:"var(--ink3)",fontSize:12}}>Loading…</div>
            ) : activeFundsVn.length > 0 ? (
              <table style={{width:"100%",borderCollapse:"collapse"}}>
                <thead><tr>
                  <th style={th}>#</th>
                  <th style={th}>Fund</th>
                  <th style={th}>Deals</th>
                  <th style={{...th,textAlign:"right"}}>Signed investment</th>
                </tr></thead>
                <tbody>
                  {activeFundsVn.flatMap((f: any, i: number) => {
                    const rows = [(
                      <tr key={f.name} onClick={() => setExpandedFundSigned(expandedFundSigned === f.name ? null : f.name)} style={{cursor:"pointer"}}>
                        <td style={td}><span className="rank">{i+1}</span></td>
                        <td style={td}><div style={{fontWeight:500}}>{f.name}</div><div className="bar-bg"><div className="bar-fill" style={{width:`${Math.round(f.amount/maxActiveFundVn*100)}%`,background:"var(--pur)"}}/></div></td>
                        <td style={td}>{f.deals}</td>
                        <td style={{...td,color:"var(--pur)",fontWeight:600,textAlign:"right"}}>{fmt(f.amount)} {expandedFundSigned === f.name ? "▲" : "▼"}</td>
                      </tr>
                    )]
                    if (expandedFundSigned === f.name) {
                      rows.push(
                        <tr key={f.name+"_d"}>
                          <td colSpan={4} style={{padding:"8px 16px 12px",background:"var(--bei)",borderBottom:"1px solid var(--bdr)"}}>
                            <div style={{display:"flex",flexDirection:"column",gap:4}}>
                              {f.dealList?.sort((a: any,b: any) => b.amount - a.amount).map((d: any) => (
                                <a key={d.id} href={`https://app-eu1.hubspot.com/contacts/${PORTAL}/record/0-3/${d.id}`} target="_blank" rel="noreferrer"
                                  style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 10px",background:"#fff",borderRadius:4,border:"1px solid var(--bdr)",textDecoration:"none",fontSize:11,color:"var(--ink2)"}}>
                                  <span style={{flex:1}}>{d.name}</span>
                                  <span style={{color:"var(--ink3)",fontSize:10,marginRight:12}}>{d.owner || "—"}</span>
                                  <span style={{fontWeight:600,color:"var(--pur)"}}>{fmt(d.amount)}</span>
                                </a>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )
                    }
                    return rows
                  })}
                </tbody>
              </table>
            ) : (
              <div style={{padding:"24px",textAlign:"center",color:"var(--ink3)",fontSize:12}}>No deals in this date range</div>
            )}
          </div>
          <div className="cc">
            <div className="cc-head"><div><div className="cc-title">Distribution per fund · VaekstNet</div><div className="cc-sub">Signed amount · closed_won · {fundDateLabel ?? "Since launch"}</div></div></div>
            <canvas id="c8" width={380} height={200} style={{maxWidth:"100%"}}/>
          </div>
        </div>
        </div>{/* /deals-2 */}
        </div>{/* /dk-region */}

        {/* ── SE Sweden ──────────────────────────────────────────────────────── */}
        <div style={{display: region==="se" ? "" : "none"}}>

        {/* ─── DEALS CLOSED · SE ───────────────────────────────────────────── */}
        <div style={{padding:"14px 0 6px",borderTop:"3px solid var(--blu)",marginTop:8}}>
          <span style={{fontSize:12,fontWeight:700,letterSpacing:".06em",textTransform:"uppercase",color:"var(--blu)"}}>Deals Closed · Brand Sweden</span>
          <span style={{fontSize:10,color:"var(--ink3)",marginLeft:10}}>Filtered by Close Date · All BU SE pipelines</span>
        </div>

        {/* SE Filter bar */}
        <div style={{display:"flex",flexWrap:"wrap",gap:16,padding:"12px",alignItems:"flex-end",background:"rgba(45,104,176,.04)",borderRadius:6,marginBottom:8}}>
          <div style={{display:"flex",flexDirection:"column",gap:4}}>
            <span style={lblStyle}>Close Date</span>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <input type="date" value={seC1From} onChange={e => { setSeC1From(e.target.value); setSeDealsTriggered(true) }} style={{fontSize:12,padding:"6px 10px",border:"1px solid var(--bdr)",borderRadius:4,fontFamily:"inherit",color:"var(--ink2)",background:"#fff"}} />
              <span style={{color:"var(--ink3)"}}>—</span>
              <input type="date" value={seC1To} onChange={e => { setSeC1To(e.target.value); setSeDealsTriggered(true) }} style={{fontSize:12,padding:"6px 10px",border:"1px solid var(--bdr)",borderRadius:4,fontFamily:"inherit",color:"var(--ink2)",background:"#fff"}} />
            </div>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:4}}>
            <span style={lblStyle}>Pipeline Deal Stage</span>
            <select value={seC1Stage} onChange={e => setSeC1Stage(e.target.value)} style={selStyle}>
              <option value="">All stages</option>
              <option value="Closed Won">Closed Won</option>
              <option value="Closed Lost">Closed Lost</option>
              <option value="Subscription Form Sent">Subscription Form Sent</option>
              <option value="Negotiations">Negotiations</option>
            </select>
          </div>
          {sePipelineOpts.length > 0 && (
            <div style={{display:"flex",flexDirection:"column",gap:4}}>
              <span style={lblStyle}>Pipeline</span>
              <select value={seC1Pipeline} onChange={e => setSeC1Pipeline(e.target.value)} style={selStyle}>
                <option value="">All pipelines</option>
                {sePipelineOpts.map((p: string) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          )}
          {seOwnerOpts.length > 0 && (
            <div style={{display:"flex",flexDirection:"column",gap:4}}>
              <span style={lblStyle}>Deal Owner</span>
              <select value={seC1Owner} onChange={e => setSeC1Owner(e.target.value)} style={selStyle}>
                <option value="">All owners</option>
                {seOwnerOpts.map((o: string) => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          )}
          {seHasFilter && (
            <button onClick={() => { setSeC1From(_ytdFrom); setSeC1To(_ytdTo); setSeC1Stage(""); setSeC1Pipeline(""); setSeC1Owner("") }}
              style={{fontSize:11,fontWeight:600,padding:"6px 14px",border:"1px solid var(--bdr)",borderRadius:4,background:"transparent",cursor:"pointer",color:"var(--ink3)",fontFamily:"inherit",alignSelf:"flex-end"}}>
              Clear filter
            </button>
          )}
        </div>

        {!seDealsTriggered ? (
          <button onClick={() => setSeDealsTriggered(true)}
            style={{display:"inline-flex",alignItems:"center",gap:8,fontSize:12,fontWeight:600,padding:"10px 22px",border:"none",borderRadius:6,background:"#1d4ed8",color:"#fff",cursor:"pointer",fontFamily:"inherit",marginBottom:8,letterSpacing:".03em"}}>
            Load Deals
          </button>
        ) : seClosedDealsLoading ? (
          <div style={{padding:"14px 16px",fontSize:12,color:"var(--ink3)",background:"rgba(45,104,176,.04)",borderRadius:6,marginBottom:8}}>Loading SE deals from HubSpot…</div>
        ) : null}

        <div className="tcard" style={{marginTop:8}}>
          <div className="tcard-head">
            <span className="tcard-title">
              {seC1Stage === "Subscription Form Sent" ? "Subscription Form Sent" :
               seC1Stage === "Negotiations"           ? "Negotiations" :
               "All Deals Closed Won"} · SE · {(seC1From || seC1To) ? `${seC1From || "..."} — ${seC1To || "..."}` : `${new Date().getFullYear()} YTD`}
            </span>
            <span className="tcard-sub">{seWonF.length} deals · {fmtSEK(seWonF.reduce((s: number,d: any) => s+d.amount,0))}</span>
          </div>
          {vnDealTable(seWonF, "var(--blu)", seIsOpenStage ? "created" : "closed", false, fmtSEK)}
        </div>
        {!seIsOpenStage && (
          <div className="tcard" style={{marginTop:8}}>
            <div className="tcard-head">
              <span className="tcard-title">All Deals Closed Lost · SE · {(seC1From || seC1To) ? `${seC1From || "..."} — ${seC1To || "..."}` : `${new Date().getFullYear()} YTD`}</span>
              <span className="tcard-sub">{seLostF.length} deals · {fmtSEK(seLostF.reduce((s: number,d: any) => s+d.amount,0))}</span>
            </div>
            {vnDealTable(seLostF, "var(--gld)", "closed", false, fmtSEK)}
          </div>
        )}

        {/* ─── PIPELINE REPORT · SE ────────────────────────────────────────── */}
        <div style={{marginTop:32,padding:"10px 0 6px",borderTop:"2px solid var(--grn)"}}>
          <span style={{fontSize:11,fontWeight:700,letterSpacing:".06em",textTransform:"uppercase",color:"var(--grn)"}}>Pipeline Report · Sweden</span>
          <span style={{fontSize:10,color:"var(--ink3)",marginLeft:8}}>All BU SE pipelines · {new Date().getFullYear()} YTD</span>
        </div>
        {(() => {
          const allSeDeals = [...seRapportNeg, ...seRapportSub, ...seRapportWon, ...seRapportLost]
          const pipelines = [...new Set(allSeDeals.map((d: any) => d.pipeline).filter((p: string) => p && p !== "—"))].sort()
          if (pipelines.length === 0) return (
            <div style={{padding:"24px",color:"var(--ink3)",fontSize:12,textAlign:"center"}}>No SE deals found — SE pipelines may not be configured in HubSpot yet</div>
          )
          const thS = {...th, padding:"8px 14px"}
          const tdS = {...td, padding:"8px 14px", fontSize:11}
          const tdR = {...tdS, textAlign:"right" as const}
          const C_NEG = "var(--blu)";  const BG_NEG = "rgba(45,104,176,.08)"
          const C_SUB = "var(--pur)";  const BG_SUB = "rgba(90,73,152,.08)"
          const C_WON = "var(--grn)";  const BG_WON = "rgba(21,97,76,.08)"
          const C_LOST = "var(--gld)"; const BG_LOST = "rgba(150,128,58,.08)"
          const cell = (arr: any[], color: string, bg: string, title?: string) => (
            <td style={{...tdS,textAlign:"center",background: arr.length > 0 ? bg : "transparent"}}>
              {arr.length > 0
                ? <><span style={{fontWeight:600,color,...(title ? {cursor:"pointer",textDecorationLine:"underline",textDecorationStyle:"dotted"} : {})}} onClick={title ? () => setPipelineModal({title, deals: arr, fmtAmt: fmtSEK}) : undefined}>{arr.length}</span><br/><span style={{fontSize:10,color:"var(--ink3)"}}>{fmtShortSEK(arr.reduce((s: number,d: any)=>s+d.amount,0))}</span></>
                : <span style={{color:"var(--ink3)"}}>—</span>
              }
            </td>
          )
          const totNeg  = seRapportNeg.reduce((s: number,d: any)=>s+d.amount,0)
          const totSub  = seRapportSub.reduce((s: number,d: any)=>s+d.amount,0)
          const totWon  = seRapportWon.reduce((s: number,d: any)=>s+d.amount,0)
          const totLost = seRapportLost.reduce((s: number,d: any)=>s+d.amount,0)
          return (
            <div className="tcard" style={{marginTop:8}}>
              <div style={{overflowX:"auto"}}>
                <table style={{width:"100%",borderCollapse:"collapse"}}>
                  <thead style={{position:"sticky",top:0,background:"var(--bei)",zIndex:1}}>
                    <tr>
                      <th style={thS}>Pipeline</th>
                      <th style={{...thS,textAlign:"center"}}>Negotiations</th>
                      <th style={{...thS,textAlign:"center"}}>Subscription Form Sent</th>
                      <th style={{...thS,textAlign:"center"}}>Closed Won</th>
                      <th style={{...thS,textAlign:"center"}}>Closed Lost</th>
                      <th style={{...thS,textAlign:"right",color:C_WON}}>Total Won</th>
                      <th style={{...thS,textAlign:"right",color:C_LOST}}>Total Lost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pipelines.map((pl: string) => {
                      const neg  = seRapportNeg.filter((d: any) => d.pipeline === pl)
                      const sub  = seRapportSub.filter((d: any) => d.pipeline === pl)
                      const won  = seRapportWon.filter((d: any) => d.pipeline === pl)
                      const lost = seRapportLost.filter((d: any) => d.pipeline === pl)
                      const wAmt = won.reduce((s: number,d: any)=>s+d.amount,0)
                      const lAmt = lost.reduce((s: number,d: any)=>s+d.amount,0)
                      return (
                        <tr key={pl}>
                          <td style={{...tdS,fontWeight:600,color:"var(--ink2)"}}>{pl}</td>
                          {cell(neg,  C_NEG,  BG_NEG)}
                          {cell(sub,  C_SUB,  BG_SUB)}
                          {cell(won,  C_WON,  BG_WON,  `Closed Won · ${pl}`)}
                          {cell(lost, C_LOST, BG_LOST, `Closed Lost · ${pl}`)}
                          <td style={{...tdR,fontWeight:600,color:C_WON}}>{wAmt > 0 ? fmtSEK(wAmt) : "—"}</td>
                          <td style={{...tdR,fontWeight:600,color:C_LOST}}>{lAmt > 0 ? fmtSEK(lAmt) : "—"}</td>
                        </tr>
                      )
                    })}
                    <tr style={{borderTop:"2px solid var(--bdr)",background:"rgba(18,20,40,.02)"}}>
                      <td style={{...tdS,fontWeight:700,color:"var(--ink1)"}}>Total</td>
                      <td style={{...tdS,textAlign:"center",fontWeight:700}}>{seRapportNeg.length > 0 ? <><span style={{color:C_NEG}}>{seRapportNeg.length}</span><br/><span style={{fontSize:10,color:"var(--ink3)"}}>{fmtShortSEK(totNeg)}</span></> : "—"}</td>
                      <td style={{...tdS,textAlign:"center",fontWeight:700}}>{seRapportSub.length > 0 ? <><span style={{color:C_SUB}}>{seRapportSub.length}</span><br/><span style={{fontSize:10,color:"var(--ink3)"}}>{fmtShortSEK(totSub)}</span></> : "—"}</td>
                      <td style={{...tdS,textAlign:"center",fontWeight:700}}>{seRapportWon.length > 0 ? <><span style={{color:C_WON,cursor:"pointer",textDecorationLine:"underline",textDecorationStyle:"dotted"}} onClick={() => setPipelineModal({title:"Closed Won · All Pipelines", deals: seRapportWon, fmtAmt: fmtSEK})}>{seRapportWon.length}</span><br/><span style={{fontSize:10,color:"var(--ink3)"}}>{fmtShortSEK(totWon)}</span></> : "—"}</td>
                      <td style={{...tdS,textAlign:"center",fontWeight:700}}>{seRapportLost.length > 0 ? <><span style={{color:C_LOST,cursor:"pointer",textDecorationLine:"underline",textDecorationStyle:"dotted"}} onClick={() => setPipelineModal({title:"Closed Lost · All Pipelines", deals: seRapportLost, fmtAmt: fmtSEK})}>{seRapportLost.length}</span><br/><span style={{fontSize:10,color:"var(--ink3)"}}>{fmtShortSEK(totLost)}</span></> : "—"}</td>
                      <td style={{...tdR,fontWeight:700,color:C_WON}}>{fmtSEK(totWon)}</td>
                      <td style={{...tdR,fontWeight:700,color:C_LOST}}>{fmtSEK(totLost)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )
        })()}

        {/* ─── SIGNED PER FUND · SE ────────────────────────────────────────── */}
        <div style={{marginTop:32,padding:"10px 0 6px",borderTop:"2px solid var(--pur)"}}>
          <span style={{fontSize:11,fontWeight:700,letterSpacing:".06em",textTransform:"uppercase",color:"var(--pur)"}}>Signed per fund · Sweden · Close Date filter</span>
          <span style={{fontSize:10,color:"var(--ink3)",marginLeft:8}}>Filter by close date to view SE fund totals for any period</span>
        </div>

        <div style={{display:"flex",flexWrap:"wrap",gap:16,padding:"12px",alignItems:"flex-end",background:"rgba(90,73,152,.04)",borderRadius:6,marginTop:8,marginBottom:12}}>
          <div style={{display:"flex",flexDirection:"column",gap:4}}>
            <span style={lblStyle}>Close Date</span>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <input type="date" value={seFundDateFrom} onChange={e => setSeFundDateFrom(e.target.value)} style={{fontSize:12,padding:"6px 10px",border:"1px solid var(--bdr)",borderRadius:4,fontFamily:"inherit",color:"var(--ink2)",background:"#fff"}} />
              <span style={{color:"var(--ink3)"}}>—</span>
              <input type="date" value={seFundDateTo} onChange={e => setSeFundDateTo(e.target.value)} style={{fontSize:12,padding:"6px 10px",border:"1px solid var(--bdr)",borderRadius:4,fontFamily:"inherit",color:"var(--ink2)",background:"#fff"}} />
            </div>
          </div>
          {(seFundDateFrom || seFundDateTo) && (
            <button onClick={() => { setSeFundDateFrom(""); setSeFundDateTo(""); setSeExpandedFund(null) }}
              style={{fontSize:11,fontWeight:600,padding:"6px 14px",border:"1px solid var(--bdr)",borderRadius:4,background:"transparent",cursor:"pointer",color:"var(--ink3)",fontFamily:"inherit",alignSelf:"flex-end"}}>
              Clear filter
            </button>
          )}
          {seFundDateLoading && <span style={{fontSize:11,color:"var(--ink3)",alignSelf:"flex-end",paddingBottom:6}}>Loading…</span>}
        </div>

        <div className="g4" style={{marginBottom:20}}>
          <div className="kpi c-blu" style={{gridColumn:"span 2"}}>
            <div className="kpi-lbl">Total signed · Sweden</div>
            <div className="kpi-val xsm">{fmtSEK(seFundTotals.amount)}</div>
            <div className="kpi-sub">{seFundTotals.deals} deals · closed_won{seFundDateLabel ? ` · ${seFundDateLabel}` : ` · ${new Date().getFullYear()} YTD`}</div>
          </div>
          <div className="kpi c-ink" style={{gridColumn:"span 2"}}>
            <div className="kpi-lbl">Avg. deal size · SE</div>
            <div className="kpi-val sm">{fmtShortSEK(seFundTotals.amount / (seFundTotals.deals || 1))}</div>
            <div className="kpi-sub">avg. per deal</div>
          </div>
        </div>

        <div className="lbl"><span className="lbl-text">Signed per fund · Sweden{seFundDateLabel ? ` · ${seFundDateLabel}` : ` · ${new Date().getFullYear()} YTD`}</span></div>
        <div className="mt">
          <div className="tcard">
            <div className="tcard-head">
              <span className="tcard-title">Distribution per pipeline · Sweden</span>
              <span className="tcard-sub">closed_won · {seFundDateLabel ?? `${new Date().getFullYear()} YTD`} · {fmtSEK(seFundTotals.amount)}</span>
            </div>
            {seFundDateLoading ? (
              <div style={{padding:"24px",textAlign:"center",color:"var(--ink3)",fontSize:12}}>Loading…</div>
            ) : seFunds.length > 0 ? (
              <table style={{width:"100%",borderCollapse:"collapse"}}>
                <thead><tr>
                  <th style={th}>#</th>
                  <th style={th}>Pipeline</th>
                  <th style={th}>Deals</th>
                  <th style={{...th,textAlign:"right"}}>Signed investment</th>
                </tr></thead>
                <tbody>
                  {seFunds.flatMap((f: any, i: number) => {
                    const rows = [(
                      <tr key={f.name} onClick={() => setSeExpandedFund(seExpandedFund === f.name ? null : f.name)} style={{cursor:"pointer"}}>
                        <td style={td}><span className="rank">{i+1}</span></td>
                        <td style={td}><div style={{fontWeight:500}}>{f.name}</div><div className="bar-bg"><div className="bar-fill" style={{width:`${Math.round(f.amount/maxSeFund*100)}%`,background:"var(--blu)"}}/></div></td>
                        <td style={td}>{f.deals}</td>
                        <td style={{...td,color:"var(--blu)",fontWeight:600,textAlign:"right"}}>{fmtSEK(f.amount)} {seExpandedFund === f.name ? "▲" : "▼"}</td>
                      </tr>
                    )]
                    if (seExpandedFund === f.name) {
                      rows.push(
                        <tr key={f.name+"_d"}>
                          <td colSpan={4} style={{padding:"8px 16px 12px",background:"var(--bei)",borderBottom:"1px solid var(--bdr)"}}>
                            <div style={{display:"flex",flexDirection:"column",gap:4}}>
                              {f.dealList?.sort((a: any,b: any) => b.amount - a.amount).map((d: any) => (
                                <a key={d.id} href={`https://app-eu1.hubspot.com/contacts/${PORTAL}/record/0-3/${d.id}`} target="_blank" rel="noreferrer"
                                  style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 10px",background:"#fff",borderRadius:4,border:"1px solid var(--bdr)",textDecoration:"none",fontSize:11,color:"var(--ink2)"}}>
                                  <span style={{flex:1}}>{d.name}</span>
                                  <span style={{color:"var(--ink3)",fontSize:10,marginRight:12}}>{d.owner || "—"}</span>
                                  <span style={{fontWeight:600,color:"var(--blu)"}}>{fmtSEK(d.amount)}</span>
                                </a>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )
                    }
                    return rows
                  })}
                </tbody>
              </table>
            ) : (
              <div style={{padding:"24px",textAlign:"center",color:"var(--ink3)",fontSize:12}}>No SE deals found for this period</div>
            )}
          </div>
        </div>

        </div>{/* /se-region */}

        {/* ── Team Shipping ──────────────────────────────────────────────────── */}
        <div style={{display: region==="ship" ? "" : "none"}}>

        <div style={{padding:"14px 0 6px",borderTop:"3px solid var(--pur)",marginTop:8}}>
          <span style={{fontSize:12,fontWeight:700,letterSpacing:".06em",textTransform:"uppercase",color:"var(--pur)"}}>Deals Closed · Team Shipping</span>
          <span style={{fontSize:10,color:"var(--ink3)",marginLeft:10}}>Filtered by Close Date · BU Ship pipelines · Amounts in USD</span>
        </div>

        <div style={{display:"flex",flexWrap:"wrap",gap:16,padding:"12px",alignItems:"flex-end",background:"rgba(90,73,152,.04)",borderRadius:6,marginBottom:8}}>
          <div style={{display:"flex",flexDirection:"column",gap:4}}>
            <span style={lblStyle}>Close Date</span>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <input type="date" value={shipC1From} onChange={e => { setShipC1From(e.target.value); setShipDealsTriggered(true) }} style={{fontSize:12,padding:"6px 10px",border:"1px solid var(--bdr)",borderRadius:4,fontFamily:"inherit",color:"var(--ink2)",background:"#fff"}} />
              <span style={{color:"var(--ink3)"}}>—</span>
              <input type="date" value={shipC1To} onChange={e => { setShipC1To(e.target.value); setShipDealsTriggered(true) }} style={{fontSize:12,padding:"6px 10px",border:"1px solid var(--bdr)",borderRadius:4,fontFamily:"inherit",color:"var(--ink2)",background:"#fff"}} />
            </div>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:4}}>
            <span style={lblStyle}>Pipeline Deal Stage</span>
            <select value={shipC1Stage} onChange={e => setShipC1Stage(e.target.value)} style={selStyle}>
              <option value="">All stages</option>
              <option value="Closed Won">Closed Won</option>
              <option value="Closed Lost">Closed Lost</option>
              <option value="Subscription Form Sent">Subscription Form Sent</option>
              <option value="Negotiations">Negotiations</option>
            </select>
          </div>
          {shipPipelineOpts.length > 0 && (
            <div style={{display:"flex",flexDirection:"column",gap:4}}>
              <span style={lblStyle}>Pipeline</span>
              <select value={shipC1Pipeline} onChange={e => setShipC1Pipeline(e.target.value)} style={selStyle}>
                <option value="">All pipelines</option>
                {shipPipelineOpts.map((p: string) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          )}
          {shipOwnerOpts.length > 0 && (
            <div style={{display:"flex",flexDirection:"column",gap:4}}>
              <span style={lblStyle}>Deal Owner</span>
              <select value={shipC1Owner} onChange={e => setShipC1Owner(e.target.value)} style={selStyle}>
                <option value="">All owners</option>
                {shipOwnerOpts.map((o: string) => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          )}
          {shipHasFilter && (
            <button onClick={() => { setShipC1From(_ytdFrom); setShipC1To(_ytdTo); setShipC1Stage(""); setShipC1Pipeline(""); setShipC1Owner("") }}
              style={{fontSize:11,fontWeight:600,padding:"6px 14px",border:"1px solid var(--bdr)",borderRadius:4,background:"transparent",cursor:"pointer",color:"var(--ink3)",fontFamily:"inherit",alignSelf:"flex-end"}}>
              Clear filter
            </button>
          )}
        </div>

        {!shipDealsTriggered ? (
          <button onClick={() => setShipDealsTriggered(true)}
            style={{display:"inline-flex",alignItems:"center",gap:8,fontSize:12,fontWeight:600,padding:"10px 22px",border:"none",borderRadius:6,background:"#1d4ed8",color:"#fff",cursor:"pointer",fontFamily:"inherit",marginBottom:8,letterSpacing:".03em"}}>
            Load Deals
          </button>
        ) : shipClosedDealsLoading ? (
          <div style={{padding:"14px 16px",fontSize:12,color:"var(--ink3)",background:"rgba(90,73,152,.04)",borderRadius:6,marginBottom:8}}>Loading Shipping deals from HubSpot…</div>
        ) : null}

        <div className="tcard" style={{marginTop:8}}>
          <div className="tcard-head">
            <span className="tcard-title">
              {shipC1Stage === "Subscription Form Sent" ? "Subscription Form Sent" :
               shipC1Stage === "Negotiations"           ? "Negotiations" :
               "All Deals Closed Won"} · Ship · {(shipC1From || shipC1To) ? `${shipC1From || "..."} — ${shipC1To || "..."}` : `${new Date().getFullYear()} YTD`}
            </span>
            <span className="tcard-sub">{shipWonF.length} deals · {fmtUSD(shipWonF.reduce((s: number,d: any) => s+d.amount,0))}</span>
          </div>
          {vnDealTable(shipWonF, "var(--pur)", shipIsOpenStage ? "created" : "closed", false, fmtUSD, SHIP_PORTAL)}
        </div>
        {!shipIsOpenStage && (
          <div className="tcard" style={{marginTop:8}}>
            <div className="tcard-head">
              <span className="tcard-title">All Deals Closed Lost · Ship · {(shipC1From || shipC1To) ? `${shipC1From || "..."} — ${shipC1To || "..."}` : `${new Date().getFullYear()} YTD`}</span>
              <span className="tcard-sub">{shipLostF.length} deals · {fmtUSD(shipLostF.reduce((s: number,d: any) => s+d.amount,0))}</span>
            </div>
            {vnDealTable(shipLostF, "var(--gld)", "closed", false, fmtUSD, SHIP_PORTAL)}
          </div>
        )}

        {/* ── Distribution Charts ── */}
        {(() => {
          if (shipWonF.length === 0) return null
          const byOwner: Record<string, { count: number; amount: number }> = {}
          for (const d of shipWonF) {
            const owner = d.owner || "Unknown"
            if (!byOwner[owner]) byOwner[owner] = { count: 0, amount: 0 }
            byOwner[owner].count  += 1
            byOwner[owner].amount += d.amount
          }
          // Merge partial names into full names (e.g. "Bendik" → "Bendik Steiro")
          for (const shortKey of Object.keys(byOwner)) {
            if (!byOwner[shortKey]) continue
            const shortW = shortKey.toLowerCase().split(/\s+/)
            for (const longKey of Object.keys(byOwner)) {
              if (longKey === shortKey || !byOwner[longKey]) continue
              const longW = longKey.toLowerCase().split(/\s+/)
              if (shortW.length < longW.length && shortW.every(w => longW.includes(w))) {
                byOwner[longKey].count  += byOwner[shortKey].count
                byOwner[longKey].amount += byOwner[shortKey].amount
                delete byOwner[shortKey]
                break
              }
            }
          }
          const sorted   = Object.entries(byOwner).sort((a, b) => b[1].amount - a[1].amount)
          const maxAmt   = sorted[0][1].amount
          const totalAmt = sorted.reduce((s, [, v]) => s + v.amount, 0)
          const totalCnt = shipWonF.length
          const DIST_COLORS = ["#5a4998","#1d4ed8","#065f46","#92400e","#be123c","#0369a1","#3730a3","#c2410c","#0f766e"]

          // Stacked share bar segments
          const segments = sorted.map(([owner, { amount }], i) => ({
            owner,
            pct: amount / totalAmt * 100,
            clr: DIST_COLORS[i % DIST_COLORS.length],
          }))

          return (
            <div style={{marginTop:32}}>
              <div style={{padding:"10px 0 10px",borderTop:"2px solid var(--pur)",display:"flex",alignItems:"baseline",gap:10}}>
                <span style={{fontSize:11,fontWeight:700,letterSpacing:".06em",textTransform:"uppercase",color:"var(--pur)"}}>Distribution by Consultant</span>
                <span style={{fontSize:10,color:"var(--ink3)"}}>Closed Won · {totalCnt} deals · {fmtShortUSD(totalAmt)} total</span>
              </div>

              {/* Stacked share bar */}
              <div style={{marginBottom:16}}>
                <div style={{display:"flex",height:14,borderRadius:7,overflow:"hidden",gap:1}}>
                  {segments.map(s => (
                    <div key={s.owner} title={`${s.owner}: ${s.pct.toFixed(1)}%`}
                      style={{width:`${s.pct}%`,background:s.clr,minWidth:2,flexShrink:0}} />
                  ))}
                </div>
                {/* Legend */}
                <div style={{display:"flex",flexWrap:"wrap",gap:"6px 16px",marginTop:8}}>
                  {segments.map(s => (
                    <span key={s.owner} style={{display:"flex",alignItems:"center",gap:5,fontSize:11,color:"var(--ink3)"}}>
                      <span style={{width:8,height:8,borderRadius:2,background:s.clr,display:"inline-block",flexShrink:0}} />
                      {s.owner} <span style={{fontWeight:600,color:"var(--ink2)"}}>{s.pct.toFixed(0)}%</span>
                    </span>
                  ))}
                </div>
              </div>

              {/* Leaderboard table */}
              <div style={{background:"var(--card)",border:"1px solid var(--bdr)",borderRadius:8,overflow:"hidden"}}>
                {/* Column headers */}
                <div style={{display:"grid",gridTemplateColumns:"32px 1fr 220px 90px 100px 110px",gap:0,
                  padding:"7px 16px",background:"var(--bg)",borderBottom:"1px solid var(--bdr)",
                  fontSize:10,fontWeight:700,letterSpacing:".06em",textTransform:"uppercase",color:"var(--ink3)"}}>
                  <span>#</span>
                  <span>Consultant</span>
                  <span style={{textAlign:"left",paddingLeft:4}}>Value (USD)</span>
                  <span style={{textAlign:"right"}}>Deals</span>
                  <span style={{textAlign:"right"}}>Avg size</span>
                  <span style={{textAlign:"right"}}>Share</span>
                </div>

                {sorted.map(([owner, { count, amount }], i) => {
                  const clr    = DIST_COLORS[i % DIST_COLORS.length]
                  const clrBg  = clr + "18"
                  const valPct = Math.round(amount / maxAmt * 100)
                  const avg    = Math.round(amount / count)
                  const share  = (amount / totalAmt * 100).toFixed(1)
                  return (
                    <div key={owner} style={{
                      display:"grid", gridTemplateColumns:"32px 1fr 220px 90px 100px 110px",
                      gap:0, padding:"11px 16px", alignItems:"center",
                      borderBottom:"1px solid var(--bdr)",
                      borderLeft:`3px solid ${clr}`,
                    }}>
                      {/* Rank */}
                      <span style={{fontSize:11,fontWeight:800,color:clr}}>#{i+1}</span>

                      {/* Name */}
                      <span style={{fontSize:13,fontWeight:600,color:"var(--ink1)"}}>{owner}</span>

                      {/* Value bar */}
                      <div style={{paddingLeft:4}}>
                        <div style={{display:"flex",alignItems:"center",gap:8}}>
                          <div style={{flex:1,height:8,background:"var(--bdr)",borderRadius:4,overflow:"hidden"}}>
                            <div style={{height:"100%",width:`${valPct}%`,background:clr,borderRadius:4}} />
                          </div>
                          <span style={{fontSize:12,fontWeight:700,color:clr,minWidth:60,textAlign:"right",whiteSpace:"nowrap"}}>
                            {fmtShortUSD(amount)}
                          </span>
                        </div>
                      </div>

                      {/* Count */}
                      <div style={{textAlign:"right"}}>
                        <span style={{display:"inline-flex",alignItems:"center",justifyContent:"center",
                          minWidth:26,height:22,borderRadius:11,background:clrBg,
                          fontSize:12,fontWeight:700,color:clr,padding:"0 8px"}}>
                          {count}
                        </span>
                      </div>

                      {/* Avg */}
                      <span style={{fontSize:12,fontWeight:600,color:"var(--ink2)",textAlign:"right"}}>
                        {fmtShortUSD(avg)}
                      </span>

                      {/* Share pill */}
                      <div style={{textAlign:"right"}}>
                        <span style={{display:"inline-block",padding:"2px 9px",borderRadius:10,
                          background:clrBg,fontSize:11,fontWeight:700,color:clr}}>
                          {share}%
                        </span>
                      </div>
                    </div>
                  )
                })}

                {/* Total row */}
                <div style={{display:"grid",gridTemplateColumns:"32px 1fr 220px 90px 100px 110px",
                  gap:0,padding:"10px 16px",background:"var(--bg)",alignItems:"center",
                  borderTop:"2px solid var(--bdr)"}}>
                  <span />
                  <span style={{fontSize:12,fontWeight:700,color:"var(--ink1)",letterSpacing:".03em"}}>Total</span>
                  <div style={{paddingLeft:4}}>
                    <span style={{fontSize:13,fontWeight:800,color:"var(--pur)"}}>{fmtShortUSD(totalAmt)}</span>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <span style={{fontSize:13,fontWeight:800,color:"var(--pur)"}}>{totalCnt}</span>
                  </div>
                  <span style={{fontSize:12,fontWeight:600,color:"var(--ink2)",textAlign:"right"}}>
                    {fmtShortUSD(Math.round(totalAmt / totalCnt))}
                  </span>
                  <span style={{fontSize:12,fontWeight:700,color:"var(--ink3)",textAlign:"right"}}>100%</span>
                </div>
              </div>
            </div>
          )
        })()}

        <div style={{marginTop:32,padding:"10px 0 6px",borderTop:"2px solid var(--grn)"}}>
          <span style={{fontSize:11,fontWeight:700,letterSpacing:".06em",textTransform:"uppercase",color:"var(--grn)"}}>Pipeline Report · Team Shipping</span>
          <span style={{fontSize:10,color:"var(--ink3)",marginLeft:8}}>BU Ship pipelines · {new Date().getFullYear()} YTD</span>
        </div>
        {(() => {
          const allShipDeals = [...shipRapportNeg, ...shipRapportSub, ...shipRapportWon, ...shipRapportLost]
          const pipelines = [...new Set(allShipDeals.map((d: any) => d.pipeline).filter((p: string) => p && p !== "—"))].sort()
          if (pipelines.length === 0) return (
            <div style={{padding:"24px",color:"var(--ink3)",fontSize:12,textAlign:"center"}}>No Shipping deals found — BU Ship pipelines may not be configured in HubSpot yet</div>
          )
          const thS = {...th, padding:"8px 14px"}
          const tdS = {...td, padding:"8px 14px", fontSize:11}
          const tdR = {...tdS, textAlign:"right" as const}
          const C_NEG = "var(--blu)"; const BG_NEG = "rgba(45,104,176,.08)"
          const C_SUB = "var(--pur)"; const BG_SUB = "rgba(90,73,152,.08)"
          const C_WON = "var(--grn)"; const BG_WON = "rgba(21,97,76,.08)"
          const C_LOST = "var(--gld)"; const BG_LOST = "rgba(150,128,58,.08)"
          const cell = (arr: any[], color: string, bg: string, title?: string) => (
            <td style={{...tdS,textAlign:"center",background: arr.length > 0 ? bg : "transparent"}}>
              {arr.length > 0
                ? <><span style={{fontWeight:600,color,...(title ? {cursor:"pointer",textDecorationLine:"underline",textDecorationStyle:"dotted"} : {})}} onClick={title ? () => setPipelineModal({title, deals: arr, fmtAmt: fmtUSD}) : undefined}>{arr.length}</span><br/><span style={{fontSize:10,color:"var(--ink3)"}}>{fmtShortUSD(arr.reduce((s: number,d: any)=>s+d.amount,0))}</span></>
                : <span style={{color:"var(--ink3)"}}>—</span>}
            </td>
          )
          const totNeg = shipRapportNeg.reduce((s: number,d: any)=>s+d.amount,0)
          const totSub = shipRapportSub.reduce((s: number,d: any)=>s+d.amount,0)
          const totWon = shipRapportWon.reduce((s: number,d: any)=>s+d.amount,0)
          const totLost = shipRapportLost.reduce((s: number,d: any)=>s+d.amount,0)
          return (
            <div className="tcard" style={{marginTop:8}}>
              <div style={{overflowX:"auto"}}>
                <table style={{width:"100%",borderCollapse:"collapse"}}>
                  <thead style={{position:"sticky",top:0,background:"var(--bei)",zIndex:1}}>
                    <tr>
                      <th style={thS}>Pipeline</th>
                      <th style={{...thS,textAlign:"center"}}>Negotiations</th>
                      <th style={{...thS,textAlign:"center"}}>Subscription Form Sent</th>
                      <th style={{...thS,textAlign:"center"}}>Closed Won</th>
                      <th style={{...thS,textAlign:"center"}}>Closed Lost</th>
                      <th style={{...thS,textAlign:"right",color:C_WON}}>Total Won</th>
                      <th style={{...thS,textAlign:"right",color:C_LOST}}>Total Lost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pipelines.map((pl: string) => {
                      const neg  = shipRapportNeg.filter((d: any) => d.pipeline === pl)
                      const sub  = shipRapportSub.filter((d: any) => d.pipeline === pl)
                      const won  = shipRapportWon.filter((d: any) => d.pipeline === pl)
                      const lost = shipRapportLost.filter((d: any) => d.pipeline === pl)
                      const wAmt = won.reduce((s: number,d: any)=>s+d.amount,0)
                      const lAmt = lost.reduce((s: number,d: any)=>s+d.amount,0)
                      return (
                        <tr key={pl}>
                          <td style={{...tdS,fontWeight:600,color:"var(--ink2)"}}>{pl}</td>
                          {cell(neg, C_NEG, BG_NEG)}{cell(sub, C_SUB, BG_SUB)}{cell(won, C_WON, BG_WON, `Closed Won · ${pl}`)}{cell(lost, C_LOST, BG_LOST, `Closed Lost · ${pl}`)}
                          <td style={{...tdR,color:C_WON,fontWeight:600}}>{wAmt > 0 ? fmtShortUSD(wAmt) : "—"}</td>
                          <td style={{...tdR,color:C_LOST,fontWeight:600}}>{lAmt > 0 ? fmtShortUSD(lAmt) : "—"}</td>
                        </tr>
                      )
                    })}
                    <tr style={{borderTop:"2px solid var(--bdr)"}}>
                      <td style={{...tdS,fontWeight:700,color:"var(--ink1)"}}>Total</td>
                      <td style={{...tdS,textAlign:"center",fontWeight:700}}>{shipRapportNeg.length > 0 ? <><span style={{color:C_NEG}}>{shipRapportNeg.length}</span><br/><span style={{fontSize:10,color:"var(--ink3)"}}>{fmtShortUSD(totNeg)}</span></> : "—"}</td>
                      <td style={{...tdS,textAlign:"center",fontWeight:700}}>{shipRapportSub.length > 0 ? <><span style={{color:C_SUB}}>{shipRapportSub.length}</span><br/><span style={{fontSize:10,color:"var(--ink3)"}}>{fmtShortUSD(totSub)}</span></> : "—"}</td>
                      <td style={{...tdS,textAlign:"center",fontWeight:700}}>{shipRapportWon.length > 0 ? <><span style={{color:C_WON,cursor:"pointer",textDecorationLine:"underline",textDecorationStyle:"dotted"}} onClick={() => setPipelineModal({title:"Closed Won · All Pipelines", deals: shipRapportWon, fmtAmt: fmtUSD})}>{shipRapportWon.length}</span><br/><span style={{fontSize:10,color:"var(--ink3)"}}>{fmtShortUSD(totWon)}</span></> : "—"}</td>
                      <td style={{...tdS,textAlign:"center",fontWeight:700}}>{shipRapportLost.length > 0 ? <><span style={{color:C_LOST,cursor:"pointer",textDecorationLine:"underline",textDecorationStyle:"dotted"}} onClick={() => setPipelineModal({title:"Closed Lost · All Pipelines", deals: shipRapportLost, fmtAmt: fmtUSD})}>{shipRapportLost.length}</span><br/><span style={{fontSize:10,color:"var(--ink3)"}}>{fmtShortUSD(totLost)}</span></> : "—"}</td>
                      <td style={{...tdR,color:C_WON,fontWeight:700}}>{totWon > 0 ? fmtShortUSD(totWon) : "—"}</td>
                      <td style={{...tdR,color:C_LOST,fontWeight:700}}>{totLost > 0 ? fmtShortUSD(totLost) : "—"}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )
        })()}

        <div style={{marginTop:32,padding:"10px 0 6px",borderTop:"2px solid var(--pur)"}}>
          <span style={{fontSize:11,fontWeight:700,letterSpacing:".06em",textTransform:"uppercase",color:"var(--pur)"}}>Signed per Fund · Team Shipping</span>
          <span style={{fontSize:10,color:"var(--ink3)",marginLeft:8}}>Filter by close date to compare periods</span>
        </div>
        <div style={{display:"flex",flexWrap:"wrap",gap:16,padding:"12px",alignItems:"flex-end",background:"rgba(90,73,152,.04)",borderRadius:6,marginBottom:8}}>
          <div style={{display:"flex",flexDirection:"column",gap:4}}>
            <span style={lblStyle}>Close Date Range</span>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <input type="date" value={shipFundDateFrom} onChange={e => setShipFundDateFrom(e.target.value)} style={{fontSize:12,padding:"6px 10px",border:"1px solid var(--bdr)",borderRadius:4,fontFamily:"inherit",color:"var(--ink2)",background:"#fff"}} />
              <span style={{color:"var(--ink3)"}}>—</span>
              <input type="date" value={shipFundDateTo} onChange={e => setShipFundDateTo(e.target.value)} style={{fontSize:12,padding:"6px 10px",border:"1px solid var(--bdr)",borderRadius:4,fontFamily:"inherit",color:"var(--ink2)",background:"#fff"}} />
              {(shipFundDateFrom || shipFundDateTo) && <button onClick={() => { setShipFundDateFrom(""); setShipFundDateTo("") }} style={{fontSize:11,padding:"6px 12px",border:"1px solid var(--bdr)",borderRadius:4,background:"transparent",cursor:"pointer",color:"var(--ink3)",fontFamily:"inherit"}}>Clear</button>}
              {shipFundDateLoading && <span style={{fontSize:11,color:"var(--ink3)"}}>Loading…</span>}
            </div>
          </div>
        </div>
        <div className="g4" style={{marginBottom:8}}>
          <div className="kpi" style={{borderTop:"3px solid var(--pur)"}}>
            <div className="kpi-lbl">Signed USD · {shipFundDateLabel ?? `${new Date().getFullYear()} YTD`}</div>
            <div className="kpi-val">{fmtShortUSD(shipFundTotals.amount)}</div>
            <div className="kpi-sub">{shipFundTotals.deals} deals across {shipFunds.length} fund(s)</div>
          </div>
        </div>
        {shipFunds.length > 0 ? (
          <div className="tcard">
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead><tr>
                <th style={th}>#</th>
                <th style={th}>Fund / Pipeline</th>
                <th style={th}>Deals</th>
                <th style={{...th,textAlign:"right",color:"var(--pur)"}}>Amount USD</th>
              </tr></thead>
              <tbody>
                {shipFunds.map((f: any, i: number) => {
                  const rows = [<tr key={f.name} onClick={() => setShipExpandedFund(shipExpandedFund === f.name ? null : f.name)} style={{cursor:"pointer"}}>
                    <td style={td}><span className="rank">{i+1}</span></td>
                    <td style={td}><div style={{fontWeight:500}}>{f.name}</div><div className="bar-bg"><div className="bar-fill" style={{width:`${Math.round(f.amount/maxShipFund*100)}%`,background:"var(--pur)"}}/></div></td>
                    <td style={td}>{f.deals}</td>
                    <td style={{...td,color:"var(--pur)",fontWeight:600,textAlign:"right"}}>{fmtUSD(f.amount)} {shipExpandedFund === f.name ? "▲" : "▼"}</td>
                  </tr>]
                  if (shipExpandedFund === f.name) {
                    rows.push(
                      <tr key={f.name+"_d"}>
                        <td colSpan={4} style={{padding:"8px 16px 12px",background:"var(--bei)",borderBottom:"1px solid var(--bdr)"}}>
                          <div style={{display:"flex",flexDirection:"column",gap:4}}>
                            {f.dealList?.sort((a: any,b: any) => b.amount - a.amount).map((d: any) => (
                              <a key={d.id} href={`https://app-eu1.hubspot.com/contacts/${SHIP_PORTAL}/record/0-3/${d.id}`} target="_blank" rel="noreferrer"
                                style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 10px",background:"#fff",borderRadius:4,border:"1px solid var(--bdr)",textDecoration:"none",fontSize:11,color:"var(--ink2)"}}>
                                <span style={{flex:1}}>{d.name}</span>
                                <span style={{color:"var(--ink3)",fontSize:10,marginRight:12}}>{d.owner || "—"}</span>
                                <span style={{fontWeight:600,color:"var(--pur)"}}>{fmtUSD(d.amount)}</span>
                              </a>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )
                  }
                  return rows
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{padding:"24px",textAlign:"center",color:"var(--ink3)",fontSize:12}}>No Shipping deals found for this period</div>
        )}

        </div>{/* /ship-region */}

        {/* ── Team Austria ───────────────────────────────────────────────────── */}
        <div style={{display: region==="at" ? "" : "none"}}>

        <div style={{padding:"14px 0 6px",borderTop:"3px solid var(--gld)",marginTop:8}}>
          <span style={{fontSize:12,fontWeight:700,letterSpacing:".06em",textTransform:"uppercase",color:"var(--gld)"}}>Deals Closed · Team Austria</span>
          <span style={{fontSize:10,color:"var(--ink3)",marginLeft:10}}>Filtered by Close Date · BU AT pipelines · Amounts in EUR</span>
        </div>

        <div style={{display:"flex",flexWrap:"wrap",gap:16,padding:"12px",alignItems:"flex-end",background:"rgba(150,128,58,.04)",borderRadius:6,marginBottom:8}}>
          <div style={{display:"flex",flexDirection:"column",gap:4}}>
            <span style={lblStyle}>Close Date</span>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <input type="date" value={atC1From} onChange={e => { setAtC1From(e.target.value); setAtDealsTriggered(true) }} style={{fontSize:12,padding:"6px 10px",border:"1px solid var(--bdr)",borderRadius:4,fontFamily:"inherit",color:"var(--ink2)",background:"#fff"}} />
              <span style={{color:"var(--ink3)"}}>—</span>
              <input type="date" value={atC1To} onChange={e => { setAtC1To(e.target.value); setAtDealsTriggered(true) }} style={{fontSize:12,padding:"6px 10px",border:"1px solid var(--bdr)",borderRadius:4,fontFamily:"inherit",color:"var(--ink2)",background:"#fff"}} />
            </div>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:4}}>
            <span style={lblStyle}>Pipeline Deal Stage</span>
            <select value={atC1Stage} onChange={e => setAtC1Stage(e.target.value)} style={selStyle}>
              <option value="">All stages</option>
              <option value="Closed Won">Closed Won</option>
              <option value="Closed Lost">Closed Lost</option>
              <option value="Subscription Form Sent">Subscription Form Sent</option>
              <option value="Negotiations">Negotiations</option>
            </select>
          </div>
          {atPipelineOpts.length > 0 && (
            <div style={{display:"flex",flexDirection:"column",gap:4}}>
              <span style={lblStyle}>Pipeline</span>
              <select value={atC1Pipeline} onChange={e => setAtC1Pipeline(e.target.value)} style={selStyle}>
                <option value="">All pipelines</option>
                {atPipelineOpts.map((p: string) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          )}
          {atOwnerOpts.length > 0 && (
            <div style={{display:"flex",flexDirection:"column",gap:4}}>
              <span style={lblStyle}>Deal Owner</span>
              <select value={atC1Owner} onChange={e => setAtC1Owner(e.target.value)} style={selStyle}>
                <option value="">All owners</option>
                {atOwnerOpts.map((o: string) => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          )}
          {atHasFilter && (
            <button onClick={() => { setAtC1From(_ytdFrom); setAtC1To(_ytdTo); setAtC1Stage(""); setAtC1Pipeline(""); setAtC1Owner("") }}
              style={{fontSize:11,fontWeight:600,padding:"6px 14px",border:"1px solid var(--bdr)",borderRadius:4,background:"transparent",cursor:"pointer",color:"var(--ink3)",fontFamily:"inherit",alignSelf:"flex-end"}}>
              Clear filter
            </button>
          )}
        </div>

        {!atDealsTriggered ? (
          <button onClick={() => setAtDealsTriggered(true)}
            style={{display:"inline-flex",alignItems:"center",gap:8,fontSize:12,fontWeight:600,padding:"10px 22px",border:"none",borderRadius:6,background:"#1d4ed8",color:"#fff",cursor:"pointer",fontFamily:"inherit",marginBottom:8,letterSpacing:".03em"}}>
            Load Deals
          </button>
        ) : atClosedDealsLoading ? (
          <div style={{padding:"14px 16px",fontSize:12,color:"var(--ink3)",background:"rgba(150,128,58,.04)",borderRadius:6,marginBottom:8}}>Loading Austria deals from HubSpot…</div>
        ) : null}

        <div className="tcard" style={{marginTop:8}}>
          <div className="tcard-head">
            <span className="tcard-title">
              {atC1Stage === "Subscription Form Sent" ? "Subscription Form Sent" :
               atC1Stage === "Negotiations"           ? "Negotiations" :
               "All Deals Closed Won"} · AT · {(atC1From || atC1To) ? `${atC1From || "..."} — ${atC1To || "..."}` : `${new Date().getFullYear()} YTD`}
            </span>
            <span className="tcard-sub">{atWonF.length} deals · {fmtEUR(atWonF.reduce((s: number,d: any) => s+d.amount,0))}</span>
          </div>
          {vnDealTable(atWonF, "var(--gld)", atIsOpenStage ? "created" : "closed", false, fmtEUR)}
        </div>
        {!atIsOpenStage && (
          <div className="tcard" style={{marginTop:8}}>
            <div className="tcard-head">
              <span className="tcard-title">All Deals Closed Lost · AT · {(atC1From || atC1To) ? `${atC1From || "..."} — ${atC1To || "..."}` : `${new Date().getFullYear()} YTD`}</span>
              <span className="tcard-sub">{atLostF.length} deals · {fmtEUR(atLostF.reduce((s: number,d: any) => s+d.amount,0))}</span>
            </div>
            {vnDealTable(atLostF, "var(--ink3)", "closed", false, fmtEUR)}
          </div>
        )}

        <div style={{marginTop:32,padding:"10px 0 6px",borderTop:"2px solid var(--grn)"}}>
          <span style={{fontSize:11,fontWeight:700,letterSpacing:".06em",textTransform:"uppercase",color:"var(--grn)"}}>Pipeline Report · Team Austria</span>
          <span style={{fontSize:10,color:"var(--ink3)",marginLeft:8}}>BU AT pipelines · {new Date().getFullYear()} YTD</span>
        </div>
        {(() => {
          const allATDeals = [...atRapportNeg, ...atRapportSub, ...atRapportWon, ...atRapportLost]
          const pipelines = [...new Set(allATDeals.map((d: any) => d.pipeline).filter((p: string) => p && p !== "—"))].sort()
          if (pipelines.length === 0) return (
            <div style={{padding:"24px",color:"var(--ink3)",fontSize:12,textAlign:"center"}}>No Austria deals found — BU AT pipelines may not be configured in HubSpot yet</div>
          )
          const thS = {...th, padding:"8px 14px"}
          const tdS = {...td, padding:"8px 14px", fontSize:11}
          const tdR = {...tdS, textAlign:"right" as const}
          const C_NEG = "var(--blu)"; const BG_NEG = "rgba(45,104,176,.08)"
          const C_SUB = "var(--pur)"; const BG_SUB = "rgba(90,73,152,.08)"
          const C_WON = "var(--grn)"; const BG_WON = "rgba(21,97,76,.08)"
          const C_LOST = "var(--gld)"; const BG_LOST = "rgba(150,128,58,.08)"
          const cell = (arr: any[], color: string, bg: string, title?: string) => (
            <td style={{...tdS,textAlign:"center",background: arr.length > 0 ? bg : "transparent"}}>
              {arr.length > 0
                ? <><span style={{fontWeight:600,color,...(title ? {cursor:"pointer",textDecorationLine:"underline",textDecorationStyle:"dotted"} : {})}} onClick={title ? () => setPipelineModal({title, deals: arr, fmtAmt: fmtEUR}) : undefined}>{arr.length}</span><br/><span style={{fontSize:10,color:"var(--ink3)"}}>{fmtShortEUR(arr.reduce((s: number,d: any)=>s+d.amount,0))}</span></>
                : <span style={{color:"var(--ink3)"}}>—</span>}
            </td>
          )
          const totNeg = atRapportNeg.reduce((s: number,d: any)=>s+d.amount,0)
          const totSub = atRapportSub.reduce((s: number,d: any)=>s+d.amount,0)
          const totWon = atRapportWon.reduce((s: number,d: any)=>s+d.amount,0)
          const totLost = atRapportLost.reduce((s: number,d: any)=>s+d.amount,0)
          return (
            <div className="tcard" style={{marginTop:8}}>
              <div style={{overflowX:"auto"}}>
                <table style={{width:"100%",borderCollapse:"collapse"}}>
                  <thead style={{position:"sticky",top:0,background:"var(--bei)",zIndex:1}}>
                    <tr>
                      <th style={thS}>Pipeline</th>
                      <th style={{...thS,textAlign:"center"}}>Negotiations</th>
                      <th style={{...thS,textAlign:"center"}}>Subscription Form Sent</th>
                      <th style={{...thS,textAlign:"center"}}>Closed Won</th>
                      <th style={{...thS,textAlign:"center"}}>Closed Lost</th>
                      <th style={{...thS,textAlign:"right",color:C_WON}}>Total Won</th>
                      <th style={{...thS,textAlign:"right",color:C_LOST}}>Total Lost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pipelines.map((pl: string) => {
                      const neg  = atRapportNeg.filter((d: any) => d.pipeline === pl)
                      const sub  = atRapportSub.filter((d: any) => d.pipeline === pl)
                      const won  = atRapportWon.filter((d: any) => d.pipeline === pl)
                      const lost = atRapportLost.filter((d: any) => d.pipeline === pl)
                      const wAmt = won.reduce((s: number,d: any)=>s+d.amount,0)
                      const lAmt = lost.reduce((s: number,d: any)=>s+d.amount,0)
                      return (
                        <tr key={pl}>
                          <td style={{...tdS,fontWeight:600,color:"var(--ink2)"}}>{pl}</td>
                          {cell(neg, C_NEG, BG_NEG)}{cell(sub, C_SUB, BG_SUB)}{cell(won, C_WON, BG_WON, `Closed Won · ${pl}`)}{cell(lost, C_LOST, BG_LOST, `Closed Lost · ${pl}`)}
                          <td style={{...tdR,color:C_WON,fontWeight:600}}>{wAmt > 0 ? fmtShortEUR(wAmt) : "—"}</td>
                          <td style={{...tdR,color:C_LOST,fontWeight:600}}>{lAmt > 0 ? fmtShortEUR(lAmt) : "—"}</td>
                        </tr>
                      )
                    })}
                    <tr style={{borderTop:"2px solid var(--bdr)"}}>
                      <td style={{...tdS,fontWeight:700,color:"var(--ink1)"}}>Total</td>
                      <td style={{...tdS,textAlign:"center",fontWeight:700}}>{atRapportNeg.length > 0 ? <><span style={{color:C_NEG}}>{atRapportNeg.length}</span><br/><span style={{fontSize:10,color:"var(--ink3)"}}>{fmtShortEUR(totNeg)}</span></> : "—"}</td>
                      <td style={{...tdS,textAlign:"center",fontWeight:700}}>{atRapportSub.length > 0 ? <><span style={{color:C_SUB}}>{atRapportSub.length}</span><br/><span style={{fontSize:10,color:"var(--ink3)"}}>{fmtShortEUR(totSub)}</span></> : "—"}</td>
                      <td style={{...tdS,textAlign:"center",fontWeight:700}}>{atRapportWon.length > 0 ? <><span style={{color:C_WON,cursor:"pointer",textDecorationLine:"underline",textDecorationStyle:"dotted"}} onClick={() => setPipelineModal({title:"Closed Won · All Pipelines", deals: atRapportWon, fmtAmt: fmtEUR})}>{atRapportWon.length}</span><br/><span style={{fontSize:10,color:"var(--ink3)"}}>{fmtShortEUR(totWon)}</span></> : "—"}</td>
                      <td style={{...tdS,textAlign:"center",fontWeight:700}}>{atRapportLost.length > 0 ? <><span style={{color:C_LOST,cursor:"pointer",textDecorationLine:"underline",textDecorationStyle:"dotted"}} onClick={() => setPipelineModal({title:"Closed Lost · All Pipelines", deals: atRapportLost, fmtAmt: fmtEUR})}>{atRapportLost.length}</span><br/><span style={{fontSize:10,color:"var(--ink3)"}}>{fmtShortEUR(totLost)}</span></> : "—"}</td>
                      <td style={{...tdR,color:C_WON,fontWeight:700}}>{totWon > 0 ? fmtShortEUR(totWon) : "—"}</td>
                      <td style={{...tdR,color:C_LOST,fontWeight:700}}>{totLost > 0 ? fmtShortEUR(totLost) : "—"}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )
        })()}

        <div style={{marginTop:32,padding:"10px 0 6px",borderTop:"2px solid var(--gld)"}}>
          <span style={{fontSize:11,fontWeight:700,letterSpacing:".06em",textTransform:"uppercase",color:"var(--gld)"}}>Signed per Fund · Team Austria</span>
          <span style={{fontSize:10,color:"var(--ink3)",marginLeft:8}}>Filter by close date to compare periods</span>
        </div>
        <div style={{display:"flex",flexWrap:"wrap",gap:16,padding:"12px",alignItems:"flex-end",background:"rgba(150,128,58,.04)",borderRadius:6,marginBottom:8}}>
          <div style={{display:"flex",flexDirection:"column",gap:4}}>
            <span style={lblStyle}>Close Date Range</span>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <input type="date" value={atFundDateFrom} onChange={e => setAtFundDateFrom(e.target.value)} style={{fontSize:12,padding:"6px 10px",border:"1px solid var(--bdr)",borderRadius:4,fontFamily:"inherit",color:"var(--ink2)",background:"#fff"}} />
              <span style={{color:"var(--ink3)"}}>—</span>
              <input type="date" value={atFundDateTo} onChange={e => setAtFundDateTo(e.target.value)} style={{fontSize:12,padding:"6px 10px",border:"1px solid var(--bdr)",borderRadius:4,fontFamily:"inherit",color:"var(--ink2)",background:"#fff"}} />
              {(atFundDateFrom || atFundDateTo) && <button onClick={() => { setAtFundDateFrom(""); setAtFundDateTo("") }} style={{fontSize:11,padding:"6px 12px",border:"1px solid var(--bdr)",borderRadius:4,background:"transparent",cursor:"pointer",color:"var(--ink3)",fontFamily:"inherit"}}>Clear</button>}
              {atFundDateLoading && <span style={{fontSize:11,color:"var(--ink3)"}}>Loading…</span>}
            </div>
          </div>
        </div>
        <div className="g4" style={{marginBottom:8}}>
          <div className="kpi" style={{borderTop:"3px solid var(--gld)"}}>
            <div className="kpi-lbl">Signed EUR · {atFundDateLabel ?? `${new Date().getFullYear()} YTD`}</div>
            <div className="kpi-val">{fmtShortEUR(atFundTotals.amount)}</div>
            <div className="kpi-sub">{atFundTotals.deals} deals across {atFunds.length} fund(s)</div>
          </div>
        </div>
        {atFunds.length > 0 ? (
          <div className="tcard">
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead><tr>
                <th style={th}>#</th>
                <th style={th}>Fund / Pipeline</th>
                <th style={th}>Deals</th>
                <th style={{...th,textAlign:"right",color:"var(--gld)"}}>Amount EUR</th>
              </tr></thead>
              <tbody>
                {atFunds.map((f: any, i: number) => {
                  const rows = [<tr key={f.name} onClick={() => setAtExpandedFund(atExpandedFund === f.name ? null : f.name)} style={{cursor:"pointer"}}>
                    <td style={td}><span className="rank">{i+1}</span></td>
                    <td style={td}><div style={{fontWeight:500}}>{f.name}</div><div className="bar-bg"><div className="bar-fill" style={{width:`${Math.round(f.amount/maxATFund*100)}%`,background:"var(--gld)"}}/></div></td>
                    <td style={td}>{f.deals}</td>
                    <td style={{...td,color:"var(--gld)",fontWeight:600,textAlign:"right"}}>{fmtEUR(f.amount)} {atExpandedFund === f.name ? "▲" : "▼"}</td>
                  </tr>]
                  if (atExpandedFund === f.name) {
                    rows.push(
                      <tr key={f.name+"_d"}>
                        <td colSpan={4} style={{padding:"8px 16px 12px",background:"var(--bei)",borderBottom:"1px solid var(--bdr)"}}>
                          <div style={{display:"flex",flexDirection:"column",gap:4}}>
                            {f.dealList?.sort((a: any,b: any) => b.amount - a.amount).map((d: any) => (
                              <a key={d.id} href={`https://app-eu1.hubspot.com/contacts/${PORTAL}/record/0-3/${d.id}`} target="_blank" rel="noreferrer"
                                style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 10px",background:"#fff",borderRadius:4,border:"1px solid var(--bdr)",textDecoration:"none",fontSize:11,color:"var(--ink2)"}}>
                                <span style={{flex:1}}>{d.name}</span>
                                <span style={{color:"var(--ink3)",fontSize:10,marginRight:12}}>{d.owner || "—"}</span>
                                <span style={{fontWeight:600,color:"var(--gld)"}}>{fmtEUR(d.amount)}</span>
                              </a>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )
                  }
                  return rows
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{padding:"24px",textAlign:"center",color:"var(--ink3)",fontSize:12}}>No Austria deals found for this period</div>
        )}

        </div>{/* /at-region */}

        {/* ── Team Finland ───────────────────────────────────────────────────── */}
        <div style={{display: region==="fi" ? "" : "none"}}>

        <div style={{padding:"14px 0 6px",borderTop:"3px solid var(--blu)",marginTop:8}}>
          <span style={{fontSize:12,fontWeight:700,letterSpacing:".06em",textTransform:"uppercase",color:"var(--blu)"}}>Deals Closed · Team Finland</span>
          <span style={{fontSize:10,color:"var(--ink3)",marginLeft:10}}>Filtered by Close Date · BU FI pipelines · Amounts in EUR</span>
        </div>

        <div style={{display:"flex",flexWrap:"wrap",gap:16,padding:"12px",alignItems:"flex-end",background:"rgba(45,104,176,.04)",borderRadius:6,marginBottom:8}}>
          <div style={{display:"flex",flexDirection:"column",gap:4}}>
            <span style={lblStyle}>Close Date</span>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <input type="date" value={fiC1From} onChange={e => { setFiC1From(e.target.value); setFiDealsTriggered(true) }} style={{fontSize:12,padding:"6px 10px",border:"1px solid var(--bdr)",borderRadius:4,fontFamily:"inherit",color:"var(--ink2)",background:"#fff"}} />
              <span style={{color:"var(--ink3)"}}>—</span>
              <input type="date" value={fiC1To} onChange={e => { setFiC1To(e.target.value); setFiDealsTriggered(true) }} style={{fontSize:12,padding:"6px 10px",border:"1px solid var(--bdr)",borderRadius:4,fontFamily:"inherit",color:"var(--ink2)",background:"#fff"}} />
            </div>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:4}}>
            <span style={lblStyle}>Pipeline Deal Stage</span>
            <select value={fiC1Stage} onChange={e => setFiC1Stage(e.target.value)} style={selStyle}>
              <option value="">All stages</option>
              <option value="Closed Won">Closed Won</option>
              <option value="Closed Lost">Closed Lost</option>
              <option value="Subscription Form Sent">Subscription Form Sent</option>
              <option value="Negotiations">Negotiations</option>
            </select>
          </div>
          {fiPipelineOpts.length > 0 && (
            <div style={{display:"flex",flexDirection:"column",gap:4}}>
              <span style={lblStyle}>Pipeline</span>
              <select value={fiC1Pipeline} onChange={e => setFiC1Pipeline(e.target.value)} style={selStyle}>
                <option value="">All pipelines</option>
                {fiPipelineOpts.map((p: string) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          )}
          {fiOwnerOpts.length > 0 && (
            <div style={{display:"flex",flexDirection:"column",gap:4}}>
              <span style={lblStyle}>Deal Owner</span>
              <select value={fiC1Owner} onChange={e => setFiC1Owner(e.target.value)} style={selStyle}>
                <option value="">All owners</option>
                {fiOwnerOpts.map((o: string) => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          )}
          {fiHasFilter && (
            <button onClick={() => { setFiC1From(_ytdFrom); setFiC1To(_ytdTo); setFiC1Stage(""); setFiC1Pipeline(""); setFiC1Owner("") }}
              style={{fontSize:11,fontWeight:600,padding:"6px 14px",border:"1px solid var(--bdr)",borderRadius:4,background:"transparent",cursor:"pointer",color:"var(--ink3)",fontFamily:"inherit",alignSelf:"flex-end"}}>
              Clear filter
            </button>
          )}
        </div>

        {!fiDealsTriggered ? (
          <button onClick={() => setFiDealsTriggered(true)}
            style={{display:"inline-flex",alignItems:"center",gap:8,fontSize:12,fontWeight:600,padding:"10px 22px",border:"none",borderRadius:6,background:"#1d4ed8",color:"#fff",cursor:"pointer",fontFamily:"inherit",marginBottom:8,letterSpacing:".03em"}}>
            Load Deals
          </button>
        ) : fiClosedDealsLoading ? (
          <div style={{padding:"14px 16px",fontSize:12,color:"var(--ink3)",background:"rgba(45,104,176,.04)",borderRadius:6,marginBottom:8}}>Loading Finland deals from HubSpot…</div>
        ) : null}

        <div className="tcard" style={{marginTop:8}}>
          <div className="tcard-head">
            <span className="tcard-title">
              {fiC1Stage === "Subscription Form Sent" ? "Subscription Form Sent" :
               fiC1Stage === "Negotiations"           ? "Negotiations" :
               "All Deals Closed Won"} · FI · {(fiC1From || fiC1To) ? `${fiC1From || "..."} — ${fiC1To || "..."}` : `${new Date().getFullYear()} YTD`}
            </span>
            <span className="tcard-sub">{fiWonF.length} deals · {fmtEUR(fiWonF.reduce((s: number,d: any) => s+d.amount,0))}</span>
          </div>
          {vnDealTable(fiWonF, "var(--blu)", fiIsOpenStage ? "created" : "closed", false, fmtEUR)}
        </div>
        {!fiIsOpenStage && (
          <div className="tcard" style={{marginTop:8}}>
            <div className="tcard-head">
              <span className="tcard-title">All Deals Closed Lost · FI · {(fiC1From || fiC1To) ? `${fiC1From || "..."} — ${fiC1To || "..."}` : `${new Date().getFullYear()} YTD`}</span>
              <span className="tcard-sub">{fiLostF.length} deals · {fmtEUR(fiLostF.reduce((s: number,d: any) => s+d.amount,0))}</span>
            </div>
            {vnDealTable(fiLostF, "var(--gld)", "closed", false, fmtEUR)}
          </div>
        )}

        {/* ─── PIPELINE REPORT · FI ────────────────────────────────────────── */}
        <div style={{marginTop:32,padding:"10px 0 6px",borderTop:"2px solid var(--grn)"}}>
          <span style={{fontSize:11,fontWeight:700,letterSpacing:".06em",textTransform:"uppercase",color:"var(--grn)"}}>Pipeline Report · Finland</span>
          <span style={{fontSize:10,color:"var(--ink3)",marginLeft:8}}>All BU FI pipelines · {new Date().getFullYear()} YTD</span>
        </div>
        {(() => {
          const allFIDeals = [...fiRapportNeg, ...fiRapportSub, ...fiRapportWon, ...fiRapportLost]
          const pipelines = [...new Set(allFIDeals.map((d: any) => d.pipeline).filter((p: string) => p && p !== "—"))].sort()
          if (pipelines.length === 0) return (
            <div style={{padding:"24px",color:"var(--ink3)",fontSize:12,textAlign:"center"}}>No Finland deals found — BU FI pipelines may not be configured in HubSpot yet</div>
          )
          const thS = {...th, padding:"8px 14px"}
          const tdS = {...td, padding:"8px 14px", fontSize:11}
          const tdR = {...tdS, textAlign:"right" as const}
          const C_NEG = "var(--blu)"; const BG_NEG = "rgba(45,104,176,.08)"
          const C_SUB = "var(--pur)"; const BG_SUB = "rgba(90,73,152,.08)"
          const C_WON = "var(--grn)"; const BG_WON = "rgba(21,97,76,.08)"
          const C_LOST = "var(--gld)"; const BG_LOST = "rgba(150,128,58,.08)"
          const cell = (arr: any[], color: string, bg: string, title?: string) => (
            <td style={{...tdS,textAlign:"center",background: arr.length > 0 ? bg : "transparent"}}>
              {arr.length > 0
                ? <><span style={{fontWeight:600,color,...(title ? {cursor:"pointer",textDecorationLine:"underline",textDecorationStyle:"dotted"} : {})}} onClick={title ? () => setPipelineModal({title, deals: arr, fmtAmt: fmtEUR}) : undefined}>{arr.length}</span><br/><span style={{fontSize:10,color:"var(--ink3)"}}>{fmtShortEUR(arr.reduce((s: number,d: any)=>s+d.amount,0))}</span></>
                : <span style={{color:"var(--ink3)"}}>—</span>}
            </td>
          )
          const totNeg = fiRapportNeg.reduce((s: number,d: any)=>s+d.amount,0)
          const totSub = fiRapportSub.reduce((s: number,d: any)=>s+d.amount,0)
          const totWon = fiRapportWon.reduce((s: number,d: any)=>s+d.amount,0)
          const totLost = fiRapportLost.reduce((s: number,d: any)=>s+d.amount,0)
          return (
            <div className="tcard" style={{marginTop:8}}>
              <div style={{overflowX:"auto"}}>
                <table style={{width:"100%",borderCollapse:"collapse"}}>
                  <thead style={{position:"sticky",top:0,background:"var(--bei)",zIndex:1}}>
                    <tr>
                      <th style={thS}>Pipeline</th>
                      <th style={{...thS,textAlign:"center"}}>Negotiations</th>
                      <th style={{...thS,textAlign:"center"}}>Subscription Form Sent</th>
                      <th style={{...thS,textAlign:"center"}}>Closed Won</th>
                      <th style={{...thS,textAlign:"center"}}>Closed Lost</th>
                      <th style={{...thS,textAlign:"right",color:C_WON}}>Total Won</th>
                      <th style={{...thS,textAlign:"right",color:C_LOST}}>Total Lost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pipelines.map((pl: string) => {
                      const neg  = fiRapportNeg.filter((d: any) => d.pipeline === pl)
                      const sub  = fiRapportSub.filter((d: any) => d.pipeline === pl)
                      const won  = fiRapportWon.filter((d: any) => d.pipeline === pl)
                      const lost = fiRapportLost.filter((d: any) => d.pipeline === pl)
                      const wAmt = won.reduce((s: number,d: any)=>s+d.amount,0)
                      const lAmt = lost.reduce((s: number,d: any)=>s+d.amount,0)
                      return (
                        <tr key={pl}>
                          <td style={{...tdS,fontWeight:600,color:"var(--ink2)"}}>{pl}</td>
                          {cell(neg, C_NEG, BG_NEG)}{cell(sub, C_SUB, BG_SUB)}{cell(won, C_WON, BG_WON, `Closed Won · ${pl}`)}{cell(lost, C_LOST, BG_LOST, `Closed Lost · ${pl}`)}
                          <td style={{...tdR,color:C_WON,fontWeight:600}}>{wAmt > 0 ? fmtShortEUR(wAmt) : "—"}</td>
                          <td style={{...tdR,color:C_LOST,fontWeight:600}}>{lAmt > 0 ? fmtShortEUR(lAmt) : "—"}</td>
                        </tr>
                      )
                    })}
                    <tr style={{borderTop:"2px solid var(--bdr)"}}>
                      <td style={{...tdS,fontWeight:700,color:"var(--ink1)"}}>Total</td>
                      <td style={{...tdS,textAlign:"center",fontWeight:700}}>{fiRapportNeg.length > 0 ? <><span style={{color:C_NEG}}>{fiRapportNeg.length}</span><br/><span style={{fontSize:10,color:"var(--ink3)"}}>{fmtShortEUR(totNeg)}</span></> : "—"}</td>
                      <td style={{...tdS,textAlign:"center",fontWeight:700}}>{fiRapportSub.length > 0 ? <><span style={{color:C_SUB}}>{fiRapportSub.length}</span><br/><span style={{fontSize:10,color:"var(--ink3)"}}>{fmtShortEUR(totSub)}</span></> : "—"}</td>
                      <td style={{...tdS,textAlign:"center",fontWeight:700}}>{fiRapportWon.length > 0 ? <><span style={{color:C_WON,cursor:"pointer",textDecorationLine:"underline",textDecorationStyle:"dotted"}} onClick={() => setPipelineModal({title:"Closed Won · All Pipelines", deals: fiRapportWon, fmtAmt: fmtEUR})}>{fiRapportWon.length}</span><br/><span style={{fontSize:10,color:"var(--ink3)"}}>{fmtShortEUR(totWon)}</span></> : "—"}</td>
                      <td style={{...tdS,textAlign:"center",fontWeight:700}}>{fiRapportLost.length > 0 ? <><span style={{color:C_LOST,cursor:"pointer",textDecorationLine:"underline",textDecorationStyle:"dotted"}} onClick={() => setPipelineModal({title:"Closed Lost · All Pipelines", deals: fiRapportLost, fmtAmt: fmtEUR})}>{fiRapportLost.length}</span><br/><span style={{fontSize:10,color:"var(--ink3)"}}>{fmtShortEUR(totLost)}</span></> : "—"}</td>
                      <td style={{...tdR,color:C_WON,fontWeight:700}}>{totWon > 0 ? fmtShortEUR(totWon) : "—"}</td>
                      <td style={{...tdR,color:C_LOST,fontWeight:700}}>{totLost > 0 ? fmtShortEUR(totLost) : "—"}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )
        })()}

        <div style={{marginTop:32,padding:"10px 0 6px",borderTop:"2px solid var(--pur)"}}>
          <span style={{fontSize:11,fontWeight:700,letterSpacing:".06em",textTransform:"uppercase",color:"var(--pur)"}}>Signed per Fund · Team Finland</span>
          <span style={{fontSize:10,color:"var(--ink3)",marginLeft:8}}>Filter by close date to compare periods</span>
        </div>
        <div style={{display:"flex",flexWrap:"wrap",gap:16,padding:"12px",alignItems:"flex-end",background:"rgba(90,73,152,.04)",borderRadius:6,marginBottom:8}}>
          <div style={{display:"flex",flexDirection:"column",gap:4}}>
            <span style={lblStyle}>Close Date Range</span>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <input type="date" value={fiFundDateFrom} onChange={e => setFiFundDateFrom(e.target.value)} style={{fontSize:12,padding:"6px 10px",border:"1px solid var(--bdr)",borderRadius:4,fontFamily:"inherit",color:"var(--ink2)",background:"#fff"}} />
              <span style={{color:"var(--ink3)"}}>—</span>
              <input type="date" value={fiFundDateTo} onChange={e => setFiFundDateTo(e.target.value)} style={{fontSize:12,padding:"6px 10px",border:"1px solid var(--bdr)",borderRadius:4,fontFamily:"inherit",color:"var(--ink2)",background:"#fff"}} />
              {(fiFundDateFrom || fiFundDateTo) && <button onClick={() => { setFiFundDateFrom(""); setFiFundDateTo("") }} style={{fontSize:11,padding:"6px 12px",border:"1px solid var(--bdr)",borderRadius:4,background:"transparent",cursor:"pointer",color:"var(--ink3)",fontFamily:"inherit"}}>Clear</button>}
              {fiFundDateLoading && <span style={{fontSize:11,color:"var(--ink3)"}}>Loading…</span>}
            </div>
          </div>
        </div>
        <div className="g4" style={{marginBottom:8}}>
          <div className="kpi" style={{borderTop:"3px solid var(--blu)"}}>
            <div className="kpi-lbl">Signed EUR · {fiFundDateLabel ?? `${new Date().getFullYear()} YTD`}</div>
            <div className="kpi-val">{fmtShortEUR(fiFundTotals.amount)}</div>
            <div className="kpi-sub">{fiFundTotals.deals} deals across {fiFunds.length} fund(s)</div>
          </div>
        </div>
        {fiFunds.length > 0 ? (
          <div className="tcard">
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead><tr>
                <th style={th}>#</th>
                <th style={th}>Fund / Pipeline</th>
                <th style={th}>Deals</th>
                <th style={{...th,textAlign:"right",color:"var(--blu)"}}>Amount EUR</th>
              </tr></thead>
              <tbody>
                {fiFunds.map((f: any, i: number) => {
                  const rows = [<tr key={f.name} onClick={() => setFiExpandedFund(fiExpandedFund === f.name ? null : f.name)} style={{cursor:"pointer"}}>
                    <td style={td}><span className="rank">{i+1}</span></td>
                    <td style={td}><div style={{fontWeight:500}}>{f.name}</div><div className="bar-bg"><div className="bar-fill" style={{width:`${Math.round(f.amount/maxFiFund*100)}%`,background:"var(--blu)"}}/></div></td>
                    <td style={td}>{f.deals}</td>
                    <td style={{...td,color:"var(--blu)",fontWeight:600,textAlign:"right"}}>{fmtEUR(f.amount)} {fiExpandedFund === f.name ? "▲" : "▼"}</td>
                  </tr>]
                  if (fiExpandedFund === f.name) {
                    rows.push(
                      <tr key={f.name+"_d"}>
                        <td colSpan={4} style={{padding:"8px 16px 12px",background:"var(--bei)",borderBottom:"1px solid var(--bdr)"}}>
                          <div style={{display:"flex",flexDirection:"column",gap:4}}>
                            {f.dealList?.sort((a: any,b: any) => b.amount - a.amount).map((d: any) => (
                              <a key={d.id} href={`https://app-eu1.hubspot.com/contacts/${PORTAL}/record/0-3/${d.id}`} target="_blank" rel="noreferrer"
                                style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 10px",background:"#fff",borderRadius:4,border:"1px solid var(--bdr)",textDecoration:"none",fontSize:11,color:"var(--ink2)"}}>
                                <span style={{flex:1}}>{d.name}</span>
                                <span style={{color:"var(--ink3)",fontSize:10,marginRight:12}}>{d.owner || "—"}</span>
                                <span style={{fontWeight:600,color:"var(--blu)"}}>{fmtEUR(d.amount)}</span>
                              </a>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )
                  }
                  return rows
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{padding:"24px",textAlign:"center",color:"var(--ink3)",fontSize:12}}>No Finland deals found for this period</div>
        )}

        </div>{/* /fi-region */}

        {/* ── Team Norway ────────────────────────────────────────────────────── */}
        <div style={{display: region==="no" ? "" : "none"}}>

        <div style={{padding:"14px 0 6px",borderTop:"3px solid #b91c1c",marginTop:8}}>
          <span style={{fontSize:12,fontWeight:700,letterSpacing:".06em",textTransform:"uppercase",color:"#b91c1c"}}>Deals Closed · Team Norway</span>
          <span style={{fontSize:10,color:"var(--ink3)",marginLeft:10}}>Filtered by Close Date · BU NO pipelines · Amounts in NOK</span>
        </div>

        <div style={{display:"flex",flexWrap:"wrap",gap:16,padding:"12px",alignItems:"flex-end",background:"rgba(185,28,28,.04)",borderRadius:6,marginBottom:8}}>
          <div style={{display:"flex",flexDirection:"column",gap:4}}>
            <span style={lblStyle}>Close Date</span>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <input type="date" value={noC1From} onChange={e => { setNoC1From(e.target.value); setNoDealsTriggered(true) }} style={{fontSize:12,padding:"6px 10px",border:"1px solid var(--bdr)",borderRadius:4,fontFamily:"inherit",color:"var(--ink2)",background:"#fff"}} />
              <span style={{color:"var(--ink3)"}}>—</span>
              <input type="date" value={noC1To} onChange={e => { setNoC1To(e.target.value); setNoDealsTriggered(true) }} style={{fontSize:12,padding:"6px 10px",border:"1px solid var(--bdr)",borderRadius:4,fontFamily:"inherit",color:"var(--ink2)",background:"#fff"}} />
            </div>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:4}}>
            <span style={lblStyle}>Pipeline Deal Stage</span>
            <select value={noC1Stage} onChange={e => setNoC1Stage(e.target.value)} style={selStyle}>
              <option value="">All stages</option>
              <option value="Closed Won">Closed Won</option>
              <option value="Closed Lost">Closed Lost</option>
              <option value="Subscription Form Sent">Subscription Form Sent</option>
              <option value="Negotiations">Negotiations</option>
            </select>
          </div>
          {noPipelineOpts.length > 0 && (
            <div style={{display:"flex",flexDirection:"column",gap:4}}>
              <span style={lblStyle}>Pipeline</span>
              <select value={noC1Pipeline} onChange={e => setNoC1Pipeline(e.target.value)} style={selStyle}>
                <option value="">All pipelines</option>
                {noPipelineOpts.map((p: string) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          )}
          {noOwnerOpts.length > 0 && (
            <div style={{display:"flex",flexDirection:"column",gap:4}}>
              <span style={lblStyle}>Deal Owner</span>
              <select value={noC1Owner} onChange={e => setNoC1Owner(e.target.value)} style={selStyle}>
                <option value="">All owners</option>
                {noOwnerOpts.map((o: string) => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          )}
          {noHasFilter && (
            <button onClick={() => { setNoC1From(_ytdFrom); setNoC1To(_ytdTo); setNoC1Stage(""); setNoC1Pipeline(""); setNoC1Owner("") }}
              style={{fontSize:11,fontWeight:600,padding:"6px 14px",border:"1px solid var(--bdr)",borderRadius:4,background:"transparent",cursor:"pointer",color:"var(--ink3)",fontFamily:"inherit",alignSelf:"flex-end"}}>
              Clear filter
            </button>
          )}
        </div>

        {!noDealsTriggered ? (
          <button onClick={() => setNoDealsTriggered(true)}
            style={{display:"inline-flex",alignItems:"center",gap:8,fontSize:12,fontWeight:600,padding:"10px 22px",border:"none",borderRadius:6,background:"#1d4ed8",color:"#fff",cursor:"pointer",fontFamily:"inherit",marginBottom:8,letterSpacing:".03em"}}>
            Load Deals
          </button>
        ) : noClosedDealsLoading ? (
          <div style={{padding:"14px 16px",fontSize:12,color:"var(--ink3)",background:"rgba(185,28,28,.04)",borderRadius:6,marginBottom:8}}>Loading Norway deals from HubSpot…</div>
        ) : null}

        <div className="tcard" style={{marginTop:8}}>
          <div className="tcard-head">
            <span className="tcard-title">
              {noC1Stage === "Subscription Form Sent" ? "Subscription Form Sent" :
               noC1Stage === "Negotiations"           ? "Negotiations" :
               "All Deals Closed Won"} · NO · {(noC1From || noC1To) ? `${noC1From || "..."} — ${noC1To || "..."}` : `${new Date().getFullYear()} YTD`}
            </span>
            <span className="tcard-sub">{noWonF.length} deals · {fmtNOK(noWonF.reduce((s: number,d: any) => s+d.amount,0))}</span>
          </div>
          {vnDealTable(noWonF, "#b91c1c", noIsOpenStage ? "created" : "closed", false, fmtNOK)}
        </div>
        {!noIsOpenStage && (
          <div className="tcard" style={{marginTop:8}}>
            <div className="tcard-head">
              <span className="tcard-title">All Deals Closed Lost · NO · {(noC1From || noC1To) ? `${noC1From || "..."} — ${noC1To || "..."}` : `${new Date().getFullYear()} YTD`}</span>
              <span className="tcard-sub">{noLostF.length} deals · {fmtNOK(noLostF.reduce((s: number,d: any) => s+d.amount,0))}</span>
            </div>
            {vnDealTable(noLostF, "var(--gld)", "closed", false, fmtNOK)}
          </div>
        )}

        {/* ─── PIPELINE REPORT · NO ────────────────────────────────────────── */}
        <div style={{marginTop:32,padding:"10px 0 6px",borderTop:"2px solid var(--grn)"}}>
          <span style={{fontSize:11,fontWeight:700,letterSpacing:".06em",textTransform:"uppercase",color:"var(--grn)"}}>Pipeline Report · Norway</span>
          <span style={{fontSize:10,color:"var(--ink3)",marginLeft:8}}>All BU NO pipelines · {new Date().getFullYear()} YTD</span>
        </div>
        {(() => {
          const allNODeals = [...noRapportNeg, ...noRapportSub, ...noRapportWon, ...noRapportLost]
          const pipelines = [...new Set(allNODeals.map((d: any) => d.pipeline).filter((p: string) => p && p !== "—"))].sort()
          if (pipelines.length === 0) return (
            <div style={{padding:"24px",color:"var(--ink3)",fontSize:12,textAlign:"center"}}>No Norway deals found — BU NO pipelines may not be configured in HubSpot yet</div>
          )
          const thS = {...th, padding:"8px 14px"}
          const tdS = {...td, padding:"8px 14px", fontSize:11}
          const tdR = {...tdS, textAlign:"right" as const}
          const C_NEG = "#b91c1c"; const BG_NEG = "rgba(185,28,28,.08)"
          const C_SUB = "var(--pur)"; const BG_SUB = "rgba(90,73,152,.08)"
          const C_WON = "var(--grn)"; const BG_WON = "rgba(21,97,76,.08)"
          const C_LOST = "var(--gld)"; const BG_LOST = "rgba(150,128,58,.08)"
          const cell = (arr: any[], color: string, bg: string, title?: string) => (
            <td style={{...tdS,textAlign:"center",background: arr.length > 0 ? bg : "transparent"}}>
              {arr.length > 0
                ? <><span style={{fontWeight:600,color,...(title ? {cursor:"pointer",textDecorationLine:"underline",textDecorationStyle:"dotted"} : {})}} onClick={title ? () => setPipelineModal({title, deals: arr, fmtAmt: fmtNOK}) : undefined}>{arr.length}</span><br/><span style={{fontSize:10,color:"var(--ink3)"}}>{fmtShortNOK(arr.reduce((s: number,d: any)=>s+d.amount,0))}</span></>
                : <span style={{color:"var(--ink3)"}}>—</span>}
            </td>
          )
          const totNeg = noRapportNeg.reduce((s: number,d: any)=>s+d.amount,0)
          const totSub = noRapportSub.reduce((s: number,d: any)=>s+d.amount,0)
          const totWon = noRapportWon.reduce((s: number,d: any)=>s+d.amount,0)
          const totLost = noRapportLost.reduce((s: number,d: any)=>s+d.amount,0)
          return (
            <div className="tcard" style={{marginTop:8}}>
              <div style={{overflowX:"auto"}}>
                <table style={{width:"100%",borderCollapse:"collapse"}}>
                  <thead style={{position:"sticky",top:0,background:"var(--bei)",zIndex:1}}>
                    <tr>
                      <th style={thS}>Pipeline</th>
                      <th style={{...thS,textAlign:"center"}}>Negotiations</th>
                      <th style={{...thS,textAlign:"center"}}>Subscription Form Sent</th>
                      <th style={{...thS,textAlign:"center"}}>Closed Won</th>
                      <th style={{...thS,textAlign:"center"}}>Closed Lost</th>
                      <th style={{...thS,textAlign:"right",color:C_WON}}>Total Won</th>
                      <th style={{...thS,textAlign:"right",color:C_LOST}}>Total Lost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pipelines.map((pl: string) => {
                      const neg  = noRapportNeg.filter((d: any) => d.pipeline === pl)
                      const sub  = noRapportSub.filter((d: any) => d.pipeline === pl)
                      const won  = noRapportWon.filter((d: any) => d.pipeline === pl)
                      const lost = noRapportLost.filter((d: any) => d.pipeline === pl)
                      const wAmt = won.reduce((s: number,d: any)=>s+d.amount,0)
                      const lAmt = lost.reduce((s: number,d: any)=>s+d.amount,0)
                      return (
                        <tr key={pl}>
                          <td style={{...tdS,fontWeight:600,color:"var(--ink2)"}}>{pl}</td>
                          {cell(neg, C_NEG, BG_NEG)}{cell(sub, C_SUB, BG_SUB)}{cell(won, C_WON, BG_WON, `Closed Won · ${pl}`)}{cell(lost, C_LOST, BG_LOST, `Closed Lost · ${pl}`)}
                          <td style={{...tdR,color:C_WON,fontWeight:600}}>{wAmt > 0 ? fmtShortNOK(wAmt) : "—"}</td>
                          <td style={{...tdR,color:C_LOST,fontWeight:600}}>{lAmt > 0 ? fmtShortNOK(lAmt) : "—"}</td>
                        </tr>
                      )
                    })}
                    <tr style={{borderTop:"2px solid var(--bdr)"}}>
                      <td style={{...tdS,fontWeight:700,color:"var(--ink1)"}}>Total</td>
                      <td style={{...tdS,textAlign:"center",fontWeight:700}}>{noRapportNeg.length > 0 ? <><span style={{color:C_NEG}}>{noRapportNeg.length}</span><br/><span style={{fontSize:10,color:"var(--ink3)"}}>{fmtShortNOK(totNeg)}</span></> : "—"}</td>
                      <td style={{...tdS,textAlign:"center",fontWeight:700}}>{noRapportSub.length > 0 ? <><span style={{color:C_SUB}}>{noRapportSub.length}</span><br/><span style={{fontSize:10,color:"var(--ink3)"}}>{fmtShortNOK(totSub)}</span></> : "—"}</td>
                      <td style={{...tdS,textAlign:"center",fontWeight:700}}>{noRapportWon.length > 0 ? <><span style={{color:C_WON,cursor:"pointer",textDecorationLine:"underline",textDecorationStyle:"dotted"}} onClick={() => setPipelineModal({title:"Closed Won · All Pipelines", deals: noRapportWon, fmtAmt: fmtNOK})}>{noRapportWon.length}</span><br/><span style={{fontSize:10,color:"var(--ink3)"}}>{fmtShortNOK(totWon)}</span></> : "—"}</td>
                      <td style={{...tdS,textAlign:"center",fontWeight:700}}>{noRapportLost.length > 0 ? <><span style={{color:C_LOST,cursor:"pointer",textDecorationLine:"underline",textDecorationStyle:"dotted"}} onClick={() => setPipelineModal({title:"Closed Lost · All Pipelines", deals: noRapportLost, fmtAmt: fmtNOK})}>{noRapportLost.length}</span><br/><span style={{fontSize:10,color:"var(--ink3)"}}>{fmtShortNOK(totLost)}</span></> : "—"}</td>
                      <td style={{...tdR,color:C_WON,fontWeight:700}}>{totWon > 0 ? fmtShortNOK(totWon) : "—"}</td>
                      <td style={{...tdR,color:C_LOST,fontWeight:700}}>{totLost > 0 ? fmtShortNOK(totLost) : "—"}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )
        })()}

        <div style={{marginTop:32,padding:"10px 0 6px",borderTop:"2px solid #b91c1c"}}>
          <span style={{fontSize:11,fontWeight:700,letterSpacing:".06em",textTransform:"uppercase",color:"#b91c1c"}}>Signed per Fund · Team Norway</span>
          <span style={{fontSize:10,color:"var(--ink3)",marginLeft:8}}>Filter by close date to compare periods</span>
        </div>
        <div style={{display:"flex",flexWrap:"wrap",gap:16,padding:"12px",alignItems:"flex-end",background:"rgba(185,28,28,.04)",borderRadius:6,marginBottom:8}}>
          <div style={{display:"flex",flexDirection:"column",gap:4}}>
            <span style={lblStyle}>Close Date Range</span>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <input type="date" value={noFundDateFrom} onChange={e => setNoFundDateFrom(e.target.value)} style={{fontSize:12,padding:"6px 10px",border:"1px solid var(--bdr)",borderRadius:4,fontFamily:"inherit",color:"var(--ink2)",background:"#fff"}} />
              <span style={{color:"var(--ink3)"}}>—</span>
              <input type="date" value={noFundDateTo} onChange={e => setNoFundDateTo(e.target.value)} style={{fontSize:12,padding:"6px 10px",border:"1px solid var(--bdr)",borderRadius:4,fontFamily:"inherit",color:"var(--ink2)",background:"#fff"}} />
              {(noFundDateFrom || noFundDateTo) && <button onClick={() => { setNoFundDateFrom(""); setNoFundDateTo("") }} style={{fontSize:11,padding:"6px 12px",border:"1px solid var(--bdr)",borderRadius:4,background:"transparent",cursor:"pointer",color:"var(--ink3)",fontFamily:"inherit"}}>Clear</button>}
              {noFundDateLoading && <span style={{fontSize:11,color:"var(--ink3)"}}>Loading…</span>}
            </div>
          </div>
        </div>
        <div className="g4" style={{marginBottom:8}}>
          <div className="kpi" style={{borderTop:"3px solid #b91c1c"}}>
            <div className="kpi-lbl">Signed NOK · {noFundDateLabel ?? `${new Date().getFullYear()} YTD`}</div>
            <div className="kpi-val">{fmtShortNOK(noFundTotals.amount)}</div>
            <div className="kpi-sub">{noFundTotals.deals} deals across {noFunds.length} fund(s)</div>
          </div>
        </div>
        {noFunds.length > 0 ? (
          <div className="tcard">
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead><tr>
                <th style={th}>#</th>
                <th style={th}>Fund / Pipeline</th>
                <th style={th}>Deals</th>
                <th style={{...th,textAlign:"right",color:"#b91c1c"}}>Amount NOK</th>
              </tr></thead>
              <tbody>
                {noFunds.map((f: any, i: number) => {
                  const rows = [<tr key={f.name} onClick={() => setNoExpandedFund(noExpandedFund === f.name ? null : f.name)} style={{cursor:"pointer"}}>
                    <td style={td}><span className="rank">{i+1}</span></td>
                    <td style={td}><div style={{fontWeight:500}}>{f.name}</div><div className="bar-bg"><div className="bar-fill" style={{width:`${Math.round(f.amount/maxNOFund*100)}%`,background:"#b91c1c"}}/></div></td>
                    <td style={td}>{f.deals}</td>
                    <td style={{...td,color:"#b91c1c",fontWeight:600,textAlign:"right"}}>{fmtNOK(f.amount)} {noExpandedFund === f.name ? "▲" : "▼"}</td>
                  </tr>]
                  if (noExpandedFund === f.name) {
                    rows.push(
                      <tr key={f.name+"_d"}>
                        <td colSpan={4} style={{padding:"8px 16px 12px",background:"var(--bei)",borderBottom:"1px solid var(--bdr)"}}>
                          <div style={{display:"flex",flexDirection:"column",gap:4}}>
                            {f.dealList?.sort((a: any,b: any) => b.amount - a.amount).map((d: any) => (
                              <a key={d.id} href={`https://app-eu1.hubspot.com/contacts/${PORTAL}/record/0-3/${d.id}`} target="_blank" rel="noreferrer"
                                style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 10px",background:"#fff",borderRadius:4,border:"1px solid var(--bdr)",textDecoration:"none",fontSize:11,color:"var(--ink2)"}}>
                                <span style={{flex:1}}>{d.name}</span>
                                <span style={{color:"var(--ink3)",fontSize:10,marginRight:12}}>{d.owner || "—"}</span>
                                <span style={{fontWeight:600,color:"#b91c1c"}}>{fmtNOK(d.amount)}</span>
                              </a>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )
                  }
                  return rows
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{padding:"24px",textAlign:"center",color:"var(--ink3)",fontSize:12}}>No Norway deals found for this period</div>
        )}

        </div>{/* /no-region */}

        {/* ── Compass · Vaekstnet ───────────────────────────────────────── */}
        <div style={{display: region==="compass" ? "" : "none"}}>
        {compassLoading && (
          <div style={{padding:"60px 24px",textAlign:"center",color:"var(--ink3)",fontSize:13}}>
            Loading Compass data from HubSpot — this may take up to a minute…
          </div>
        )}
        {!compassLoading && !compassData && region === "compass" && (
          <div style={{padding:"60px 24px",textAlign:"center",color:"var(--ink3)",fontSize:13}}>No data yet</div>
        )}
        {compassData && (()=>{
          // ── Design tokens (clean white theme per Thomas) ──────────────
          const C_BG    = "#ffffff"
          const C_PAGE  = "#f8f9fa"
          const C_BDR   = "#e5e7eb"
          const C_BDR2  = "#f3f4f6"
          const C_HEAD  = "#f9fafb"
          const C_INK   = "#111827"
          const C_INK2  = "#374151"
          const C_MUTED = "#6b7280"
          const C_DK    = "#1d4ed8"  // blue for Denmark
          const C_SE    = "#7c3aed"  // purple for Sweden
          const C_GRN   = "#15803d"
          const C_AMBER = "#b45309"
          const C_SEL   = "#2563eb"  // selected period accent

          const primaryMon: any  = compassData.primary  ?? compassData.thisMonth
          const compareMon: any  = compassData.compare ?? null

          const safe = (v: any): number => {
            if (v === null || v === undefined) return 0
            const n = Number(v)
            return isNaN(n) || !isFinite(n) ? 0 : n
          }
          // Convert any value to a safe string for use in <td> children
          const cell = (v: any): string => {
            if (v === null || v === undefined) return "—"
            const n = Number(v)
            if (isNaN(n) || !isFinite(n)) return "—"
            return n > 0 ? String(n) : "—"
          }
          const fmtN = (v: any): string => { const n = safe(v); return n > 0 ? n.toLocaleString("da-DK") : "—" }
          const pct  = (a: any, b: any): number => { const sb = safe(b); return sb > 0 ? Math.round(safe(a)/sb*100) : 0 }
          const pctS = (a: any, b: any): string => { const p = pct(a,b); return p > 0 ? `${p}%` : "—" }

          // Table style primitives
          const TH: React.CSSProperties  = {fontSize:11,fontWeight:600,color:C_MUTED,padding:"10px 14px",textAlign:"left",borderBottom:`1px solid ${C_BDR}`,background:C_HEAD,whiteSpace:"nowrap"}
          const THr: React.CSSProperties = {...TH,textAlign:"right"}
          const THc: React.CSSProperties = {...TH,textAlign:"center",background:C_HEAD}
          const TD: React.CSSProperties  = {fontSize:13,color:C_INK2,padding:"10px 14px",borderBottom:`1px solid ${C_BDR2}`,whiteSpace:"nowrap"}
          const TDr: React.CSSProperties = {...TD,textAlign:"right"}
          const TDc: React.CSSProperties = {...TD,textAlign:"center"}

          const sectionTitle = (txt: string) => (
            <div style={{fontSize:11,fontWeight:700,letterSpacing:".07em",textTransform:"uppercase" as const,color:C_MUTED,marginBottom:8,marginTop:24}}>{txt}</div>
          )

          const card = (children: React.ReactNode, mb=16) => (
            <div style={{background:C_BG,border:`1px solid ${C_BDR}`,borderRadius:8,overflowX:"auto",marginBottom:mb}}>{children}</div>
          )

          // Country group separator row
          const ctryRow = (label: string, color: string, cols: number) => (
            <tr>
              <td colSpan={cols} style={{...TD,background:C_HEAD,color,fontWeight:700,fontSize:11,letterSpacing:".05em",textTransform:"uppercase" as const,padding:"8px 14px",borderBottom:`1px solid ${C_BDR}`}}>{label}</td>
            </tr>
          )

          // Value cell with optional comparison delta
          const valCell = (primary: any, compare: any, fmt: (n:number)=>string, isCurrency=false) => {
            const sp = safe(primary), sc = safe(compare)
            const pv = fmt(sp)
            if (compare === null || compare === undefined) return <>{pv}</>
            const delta = sp - sc
            const sign  = delta > 0 ? "+" : ""
            const color = delta > 0 ? C_GRN : delta < 0 ? "#b91c1c" : C_MUTED
            return (
              <>
                {pv}
                {delta !== 0 && !isNaN(delta) && <span style={{display:"block",fontSize:10,color,marginTop:1}}>{sign}{isCurrency ? fmtN(delta) : String(delta)}</span>}
              </>
            )
          }

          // ── Overview metrics ──────────────────────────────────────────
          const METRICS = [
            {label:"Quality Meetings", key:"qualityMeetings", fmt:(v:number)=>String(safe(v)||"—")},
            {label:"Deal Sent",        key:"dealsSent",       fmt:(v:number)=>String(safe(v)||"—")},
            {label:"Deal Value",       key:"dealValue",       fmt:fmtN, currency:true},
            {label:"New Investments",  key:"newInvestments",  fmt:(v:number)=>String(safe(v)||"—")},
            {label:"Reinvestment",     key:"reinvestment",    fmt:(v:number)=>String(safe(v)||"—")},
            {label:"Total Investment", key:"totalInvestment", fmt:(v:number)=>String(safe(v)||"—")},
          ]

          const COUNTRIES = [
            {key:"dk", label:"Denmark", color:C_DK},
            {key:"se", label:"Sweden",  color:C_SE},
          ] as const

          // Attribution helpers
          const attrTotal = (a: any) => safe(a.new)+safe(a.vaekstnet)+safe(a.existingInvestor)
          const ATTR_ROWS = [
            {label:"New",               key:"new"},
            {label:"VaekstNet",         key:"vaekstnet"},
            {label:"Existing Investor", key:"existingInvestor"},
          ]

          return (
            <div style={{fontFamily:"inherit",minHeight:"60vh",background:C_PAGE}}>

              <div style={{padding:"28px 28px 60px"}}>
                  <div style={{maxWidth:1100,margin:"0 auto"}}>
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:28,flexWrap:"wrap" as const,gap:12}}>
                      <h2 style={{fontSize:22,fontWeight:700,color:C_INK,margin:0,letterSpacing:"-.01em"}}>
                        Investment 2026
                      </h2>
                      <button onClick={()=>setInvestPickerOpen(v=>!v)}
                        style={{display:"flex",alignItems:"center",gap:8,padding:"7px 14px",fontSize:12,fontWeight:500,border:`1px solid ${C_BDR}`,borderRadius:6,background:C_BG,color:C_INK,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap" as const}}>
                        <span>📅</span>
                        <span>{investDateLabel}</span>
                        <span style={{color:C_MUTED,fontSize:10}}>▼</span>
                      </button>
                      {investPickerOpen && <FBDatePicker onApply={(lbl,start,end)=>{setInvestDateLabel(lbl);setInvestPickerOpen(false);setCompassFrom(start);setCompassTo(end);fetchCompass(start,end,false,"","")}} onClose={()=>setInvestPickerOpen(false)}/>}
                    </div>
                    <div style={{background:C_BG,border:`1px solid ${C_BDR}`,borderRadius:8,padding:"28px 32px",marginBottom:28,maxWidth:860}}>
                      {(()=>{
                        const [selYear,selMon]=compassMonth.split("-").map(Number)
                        const today2=new Date()
                        const isCurrentMonth=selYear===today2.getFullYear()&&selMon===(today2.getMonth()+1)
                        const daysInMonth2=new Date(selYear,selMon,0).getDate()
                        const timePct2=isCurrentMonth?Math.round(today2.getDate()/daysInMonth2*100):100
                        const Bar=({label,current,goal,currency,color}:{label:string,current:number,goal:number,currency:string,color:string})=>(
                          <div style={{marginBottom:24}}>
                            <div style={{fontSize:14,fontWeight:500,color:C_INK2,marginBottom:10}}>{label}</div>
                            <div style={{height:36,background:C_BDR2,borderRadius:18,overflow:"hidden",position:"relative" as const}}>
                              <div style={{width:`${Math.min(100,Math.round(current/goal*100))}%`,height:"100%",background:color,borderRadius:18}}/>
                              {isCurrentMonth&&<div style={{position:"absolute" as const,left:`${timePct2}%`,top:0,bottom:0,width:2,background:"#111",opacity:.5}}/>}
                            </div>
                            <div style={{display:"flex",justifyContent:"space-between",marginTop:6}}>
                              <span style={{fontSize:13,fontWeight:700,color:C_INK}}>{current} M{currency}</span>
                              <span style={{fontSize:13,fontWeight:700,color:C_MUTED}}>{goal} M{currency}</span>
                            </div>
                          </div>
                        )
                        return(<>
                          <Bar label="This month - DK" current={Math.round(safe(primaryMon?.summary?.dk?.dealValue)/1_000_000)} goal={150} currency="DKK" color={C_DK}/>
                          <Bar label="This month - SE" current={Math.round(safe(primaryMon?.summary?.se?.dealValue)/1_000_000)} goal={50} currency="SEK" color={C_SE}/>
                        </>)
                      })()}
                    </div>

                    <div style={{fontSize:11,fontWeight:700,letterSpacing:".07em",textTransform:"uppercase" as const,color:C_MUTED,marginBottom:8,marginTop:8}}>Vaekstkapital Overview</div>
                    <div style={{background:C_BG,border:`1px solid ${C_BDR}`,borderRadius:8,overflowX:"auto" as const,marginBottom:16}}>
                      <table style={{width:"100%",borderCollapse:"collapse" as const}}>
                        <thead><tr>
                          <th style={{...TH,minWidth:140}}>Overview</th>
                          <th style={TH}>Database value</th>
                          {["Meetings booked","Meeting quality %","Total investment","Reinvestment","%","New investments","%"].map((h,j)=>(
                            <th key={j} style={{...THr,fontStyle:h==="Reinvestment"||h==="New investments"?"italic" as const:undefined}}>{h}</th>
                          ))}
                        </tr></thead>
                        <tbody>
                          {([["Denmark",primaryMon?.summary?.dk],["Sweden",primaryMon?.summary?.se]] as const).map(([r,s],i)=>{
                            const dkPpl=primaryMon?.people?.filter((p:any)=>p.country==="dk")||[]
                            const sePpl=primaryMon?.people?.filter((p:any)=>p.country==="se")||[]
                            const ppl=r==="Denmark"?dkPpl:sePpl
                            const sumCalls=ppl.reduce((a:number,p:any)=>a+safe(p.totalCalls),0)
                            const sumQM=ppl.reduce((a:number,p:any)=>a+safe(p.qualityMeetings),0)
                            return(
                              <tr key={r} style={{background:i%2===0?C_BG:C_BDR2}}>
                                <td style={TD}>{r}</td>
                                <td style={{...TD,color:C_MUTED,fontStyle:"italic" as const}}>—</td>
                                <td style={TDr}>{fmtN(safe(s?.qualityMeetings))}</td>
                                <td style={TDr}>{pctS(sumQM,sumCalls)}</td>
                                <td style={{...TDr,fontWeight:600}}>{fmtN(safe(s?.totalInvestment)/1_000_000)}M</td>
                                <td style={TDr}>{fmtN(safe(s?.reinvestment)/1_000_000)}M</td>
                                <td style={TDr}>{pctS(safe(s?.reinvestment),safe(s?.totalInvestment))}</td>
                                <td style={TDr}>{fmtN(safe(s?.newInvestments)/1_000_000)}M</td>
                                <td style={TDr}>{pctS(safe(s?.newInvestments),safe(s?.totalInvestment))}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>

                    <div style={{fontSize:11,fontWeight:700,letterSpacing:".07em",textTransform:"uppercase" as const,color:C_MUTED,marginBottom:8,marginTop:24}}>AUC (VaekstNet platform)</div>
                    {(()=>{
                      const aD=compassData.auc
                      const fmtM=(v:number)=>v>=1_000_000?`${(v/1_000_000).toFixed(1)}M`:`${(v/1_000).toFixed(0)}k`
                      const listed=aD?(aD.total-aD.vkFunds-aD.cash):0
                      return(
                      <div style={{background:C_BG,border:`1px solid ${C_BDR}`,borderRadius:8,overflowX:"auto" as const,marginBottom:16,maxWidth:440}}>
                        <table style={{width:"100%",borderCollapse:"collapse" as const}}>
                          <thead><tr>
                            <th style={TH}>AUC</th><th style={THr}>New</th><th style={THr}>Total</th>
                          </tr></thead>
                          <tbody>
                            {([["Cash",aD?.cash],["VK Funds",aD?.vkFunds],["Securities",listed]] as const).map(([r,v]:any,i:number)=>(
                              <tr key={r} style={{background:i%2===0?C_BG:C_BDR2}}>
                                <td style={TD}>{r}</td>
                                <td style={{...TDr,color:C_MUTED,fontStyle:"italic" as const}}>—</td>
                                <td style={{...TDr,fontWeight:600}}>{v!=null?fmtM(v):"—"}</td>
                              </tr>
                            ))}
                            <tr style={{background:C_HEAD}}>
                              <td style={{...TD,fontWeight:700,color:C_INK}}>Total</td>
                              <td style={{...TDr,fontWeight:700,color:C_INK}}></td>
                              <td style={{...TDr,fontWeight:700,color:C_INK}}>{aD?fmtM(aD.total):"—"}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                      )
                    })()}

                    <div style={{marginTop:32,background:"#121428",borderRadius:12,padding:"28px 32px",marginBottom:24}}>
                      <div style={{fontSize:18,fontWeight:700,color:"#fff",marginBottom:20}}>More dashboards</div>
                      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:16}}>
                        {(["vaekstkapital","vaekstnet","all"] as const).map(key=>(
                          <button key={key} onClick={()=>setCompassOverviewSection(key)}
                            style={{background:compassOverviewSection===key?"rgba(167,139,250,.18)":"#fff",
                              border:compassOverviewSection===key?"2px solid #a78bfa":"2px solid transparent",
                              borderRadius:12,padding:"32px 16px",fontSize:14,fontWeight:700,
                              color:compassOverviewSection===key?"#e9d5ff":C_INK,cursor:"pointer",fontFamily:"inherit",textAlign:"center" as const}}>
                            {key==="vaekstkapital"?"Vaekstkapital":key==="vaekstnet"?"VaekstNet":"All funds"}
                          </button>
                        ))}
                      </div>
                    </div>

                    {compassOverviewSection==="vaekstkapital" && (<>
                      {/* Overview by Country */}
                      <div style={{fontSize:11,fontWeight:700,letterSpacing:".07em",textTransform:"uppercase" as const,color:C_MUTED,marginBottom:8,marginTop:8}}>Overview by Country</div>
                      <div style={{background:C_BG,border:`1px solid ${C_BDR}`,borderRadius:8,overflowX:"auto" as const,marginBottom:16}}>
                        <table style={{width:"100%",borderCollapse:"collapse" as const}}>
                          <thead><tr>
                            {["Overview","Database value","Meetings booked","Meeting quality %","Total Investment","Reinvestments","New Investments"].map((h,j)=>(
                              <th key={j} style={{...j===0?TH:THr,fontStyle:j>=5?"italic" as const:undefined}}>{h}</th>
                            ))}
                          </tr></thead>
                          <tbody>
                            {([["Denmark","dk"],["Sweden","se"],["Austria",null],["Norway",null],["Finland",null]] as const).map(([r,key],i)=>{
                              const s=key?primaryMon?.summary?.[key]:null
                              const ppl=key?(primaryMon?.people?.filter((p:any)=>p.country===key)||[]):[]
                              const sumCalls=ppl.reduce((a:number,p:any)=>a+safe(p.totalCalls),0)
                              const sumQM=ppl.reduce((a:number,p:any)=>a+safe(p.qualityMeetings),0)
                              return(
                                <tr key={r} style={{background:i%2===0?C_BG:C_BDR2}}>
                                  <td style={TD}>{r}</td>
                                  <td style={{...TD,color:C_MUTED,fontStyle:"italic" as const}}>—</td>
                                  <td style={TDr}>{s?fmtN(safe(s.qualityMeetings)):""}</td>
                                  <td style={TDr}>{s?pctS(sumQM,sumCalls):""}</td>
                                  <td style={{...TDr,fontWeight:s?600:undefined}}>{s?`${fmtN(safe(s.totalInvestment)/1_000_000)}M`:""}</td>
                                  <td style={TDr}>{s?`${fmtN(safe(s.reinvestment)/1_000_000)}M`:""}</td>
                                  <td style={TDr}>{s?`${fmtN(safe(s.newInvestments)/1_000_000)}M`:""}</td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                      {/* Meeting Source — placeholder */}
                      <div style={{fontSize:11,fontWeight:700,letterSpacing:".07em",textTransform:"uppercase" as const,color:C_MUTED,marginBottom:8,marginTop:8}}>Meeting Source</div>
                      <div style={{background:C_BG,border:`1px solid ${C_BDR}`,borderRadius:8,overflowX:"auto" as const,marginBottom:16}}>
                        <table style={{width:"100%",borderCollapse:"collapse" as const}}>
                          <thead><tr>
                            <th style={TH}>Meeting Source</th>
                            {["Denmark Total","Denmark %","Sweden Total","Sweden %"].map((h,j)=>(<th key={j} style={THr}>{h}</th>))}
                          </tr></thead>
                          <tbody>
                            {["Telemarketing","Marketing","VaekstNet","Other"].map((r,i)=>(
                              <tr key={r} style={{background:i%2===0?C_BG:C_BDR2}}>
                                <td style={TD}>{r}</td>
                                {Array(4).fill(null).map((_,j)=><td key={j} style={TDr}></td>)}
                              </tr>
                            ))}
                            <tr style={{background:C_HEAD}}>
                              <td style={{...TD,fontWeight:700,color:C_INK}}>Total</td>
                              {Array(4).fill(null).map((_,j)=><td key={j} style={{...TDr,fontWeight:700,color:C_INK}}></td>)}
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      {/* Investment Source — real attribution data */}
                      {(()=>{
                        const da=primaryMon?.attribution?.dk
                        const sa=primaryMon?.attribution?.se
                        const dkTot=safe(da?.new)+safe(da?.vaekstnet)+safe(da?.existingInvestor)
                        const seTot=safe(sa?.new)+safe(sa?.vaekstnet)+safe(sa?.existingInvestor)
                        const rows=[
                          ["New investor", da?.new, sa?.new],
                          ["VaekstNet", da?.vaekstnet, sa?.vaekstnet],
                          ["Existing investor", da?.existingInvestor, sa?.existingInvestor],
                        ] as const
                        return(
                          <>
                          <div style={{fontSize:11,fontWeight:700,letterSpacing:".07em",textTransform:"uppercase" as const,color:C_MUTED,marginBottom:8,marginTop:24}}>Investment Source</div>
                          <div style={{background:C_BG,border:`1px solid ${C_BDR}`,borderRadius:8,overflowX:"auto" as const,marginBottom:16}}>
                            <table style={{width:"100%",borderCollapse:"collapse" as const}}>
                              <thead><tr>
                                <th style={TH}>Investment Source</th>
                                {["Denmark Total","Denmark %","Sweden Total","Sweden %"].map((h,j)=>(<th key={j} style={THr}>{h}</th>))}
                              </tr></thead>
                              <tbody>
                                {rows.map(([r,dv,sv],i)=>(
                                  <tr key={r} style={{background:i%2===0?C_BG:C_BDR2}}>
                                    <td style={TD}>{r}</td>
                                    <td style={TDr}>{fmtN(safe(dv)/1_000_000)}M</td>
                                    <td style={TDr}>{pctS(safe(dv),dkTot)}</td>
                                    <td style={TDr}>{fmtN(safe(sv)/1_000_000)}M</td>
                                    <td style={TDr}>{pctS(safe(sv),seTot)}</td>
                                  </tr>
                                ))}
                                <tr style={{background:C_HEAD}}>
                                  <td style={{...TD,fontWeight:700,color:C_INK}}>Total</td>
                                  <td style={{...TDr,fontWeight:700,color:C_INK}}>{fmtN(dkTot/1_000_000)}M</td>
                                  <td style={{...TDr,fontWeight:700,color:C_INK}}>100%</td>
                                  <td style={{...TDr,fontWeight:700,color:C_INK}}>{fmtN(seTot/1_000_000)}M</td>
                                  <td style={{...TDr,fontWeight:700,color:C_INK}}>100%</td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                          </>
                        )
                      })()}

                      {/* Investment Consultants — collapsible */}
                      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginTop:32,marginBottom:16,cursor:"pointer" as const,borderTop:`1px solid ${C_BDR}`,paddingTop:24}} onClick={()=>setCompassConsultantsOpen(v=>!v)}>
                        <h3 style={{fontSize:18,fontWeight:700,color:C_INK,margin:0,display:"flex",alignItems:"center",gap:10}}>
                          <span style={{fontSize:12,color:C_MUTED,userSelect:"none" as const}}>{compassConsultantsOpen?"▼":"▶"}</span>
                          Investment consultants
                        </h3>
                        <span style={{fontSize:12,color:C_DK,fontWeight:600}}>{compassConsultantsOpen?"Collapse":"Expand"}</span>
                      </div>
                      {compassConsultantsOpen && (()=>{
                        const allCons=(primaryMon?.people||[]).filter((p:any)=>p.role==="consultant")
                        const dkCons=allCons.filter((p:any)=>p.country==="dk")
                        const seCons=allCons.filter((p:any)=>p.country==="se")
                        const ConsRow=({p,bg}:{p:any,bg:string})=>{
                          const qPct=pctS(safe(p.qualityMeetings),safe(p.totalCalls))
                          return(
                            <React.Fragment>
                              <tr style={{background:bg,cursor:"pointer" as const}} onClick={()=>setExpandedConsultant(expandedConsultant===p.name?null:p.name)}>
                                <td style={{...TD,color:C_INK,fontWeight:500}}><span style={{fontSize:10,color:C_MUTED,marginRight:6,userSelect:"none" as const}}>{expandedConsultant===p.name?"▼":"▶"}</span>{p.name}</td>
                                <td style={TDr}></td><td style={TDr}></td>
                                <td style={{...TDr,fontWeight:600}}>{fmtN(safe(p.totalCalls))}</td>
                                <td style={TDr}>{p.avgCallMinutes?`${Number(p.avgCallMinutes).toFixed(1)} min`:"—"}</td>
                                <td style={TDr}>{fmtN(safe(p.qualityMeetings))}</td>
                                <td style={TDr}>{qPct}</td>
                                <td style={{...TDr,fontWeight:600}}>{safe(p.wonDeals)?fmtN(safe(p.wonDeals)):"—"}</td>
                              </tr>
                              {expandedConsultant===p.name&&(
                                <tr>
                                  <td colSpan={8} style={{padding:"14px 24px",background:C_BDR2}}>
                                    <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:16}}>
                                      {[["Won amount",safe(p.wonAmount)?`${fmtN(safe(p.wonAmount)/1_000_000)}M`:"—"],["New investments",fmtN(safe(p.newInvestments))],["Reinvestment",`${fmtN(safe(p.reinvestment)/1_000_000)}M`]].map(([lbl,val])=>(
                                        <div key={lbl} style={{background:C_BG,borderRadius:6,padding:"10px 14px",border:`1px solid ${C_BDR}`}}>
                                          <div style={{fontSize:10,color:C_MUTED,fontWeight:600,letterSpacing:".06em",textTransform:"uppercase" as const,marginBottom:4}}>{lbl}</div>
                                          <div style={{fontSize:16,fontWeight:700,color:C_INK}}>{val}</div>
                                        </div>
                                      ))}
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          )
                        }
                        const avgRow=(ppl:any[])=>{
                          if(!ppl.length)return null
                          const avgCalls=Math.round(ppl.reduce((a:number,p:any)=>a+safe(p.totalCalls),0)/ppl.length)
                          const avgQM=Math.round(ppl.reduce((a:number,p:any)=>a+safe(p.qualityMeetings),0)/ppl.length)
                          const sumCalls=ppl.reduce((a:number,p:any)=>a+safe(p.totalCalls),0)
                          const sumQM=ppl.reduce((a:number,p:any)=>a+safe(p.qualityMeetings),0)
                          return(<tr style={{background:C_HEAD}}><td style={{...TD,fontWeight:700,color:C_INK}}>Average / Total</td><td style={TDr}></td><td style={TDr}></td><td style={{...TDr,color:C_MUTED}}>{avgCalls}</td><td style={TDr}></td><td style={{...TDr,color:C_MUTED}}>{avgQM}</td><td style={{...TDr,color:C_MUTED}}>{pctS(sumQM,sumCalls)}</td><td style={TDr}></td></tr>)
                        }
                        return(<>
                          <div style={{background:C_BG,border:`1px solid ${C_BDR}`,borderRadius:8,overflowX:"auto" as const,marginBottom:16}}>
                            <table style={{width:"100%",borderCollapse:"collapse" as const}}>
                              <thead>
                                <tr>
                                  <th style={{...TH,minWidth:200}}>Investment consultants</th>
                                  <th style={THr} colSpan={2}>Database</th>
                                  <th style={THr}>Total calls</th><th style={THr}>Avg. call (min)</th>
                                  <th style={THr}>Quality meetings</th><th style={THr}>Quality %</th>
                                  <th style={THr}>Won deals</th>
                                </tr>
                                <tr>
                                  <th style={{...TH,borderTop:"none"}}></th>
                                  <th style={{...THr,borderTop:"none",fontSize:10}}>Contacts</th>
                                  <th style={{...THr,borderTop:"none",fontSize:10}}>Leads received</th>
                                  {Array(5).fill(null).map((_,j)=><th key={j} style={{...THr,borderTop:"none"}}></th>)}
                                </tr>
                              </thead>
                              <tbody>
                                <tr><td colSpan={8} style={{...TD,background:C_HEAD,color:C_DK,fontWeight:700,fontSize:11,letterSpacing:".05em",textTransform:"uppercase" as const,padding:"8px 14px",borderBottom:`1px solid ${C_BDR}`}}>Denmark</td></tr>
                                {dkCons.length?dkCons.map((p:any,i:number)=><ConsRow key={p.name} p={p} bg={i%2===0?C_BG:C_BDR2}/>):<tr><td colSpan={8} style={{...TD,color:C_MUTED,fontStyle:"italic" as const}}>No data</td></tr>}
                                {avgRow(dkCons)}
                                <tr><td colSpan={8} style={{...TD,background:C_HEAD,color:C_SE,fontWeight:700,fontSize:11,letterSpacing:".05em",textTransform:"uppercase" as const,padding:"8px 14px",borderTop:`2px solid ${C_BDR}`,borderBottom:`1px solid ${C_BDR}`}}>Sweden</td></tr>
                                {seCons.length?seCons.map((p:any,i:number)=><ConsRow key={p.name} p={p} bg={i%2===0?C_BG:C_BDR2}/>):<tr><td colSpan={8} style={{...TD,color:C_MUTED,fontStyle:"italic" as const}}>No data</td></tr>}
                                {avgRow(seCons)}
                              </tbody>
                            </table>
                          </div>
                          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginTop:16,marginBottom:6}}>
                            <div style={{fontSize:11,fontWeight:700,letterSpacing:".07em",textTransform:"uppercase" as const,color:C_MUTED}}>Call outcomes</div>
                            <button onClick={()=>setConsOutcomesPickerOpen(v=>!v)}
                              style={{display:"flex",alignItems:"center",gap:6,padding:"5px 12px",fontSize:11,fontWeight:500,border:`1px solid ${C_BDR}`,borderRadius:6,background:C_BG,color:C_INK,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap" as const}}>
                              <span>📅</span><span>{consOutcomesLabel}</span><span style={{color:C_MUTED,fontSize:9}}>▼</span>
                            </button>
                            {consOutcomesPickerOpen && <FBDatePicker onApply={(lbl)=>{setConsOutcomesLabel(lbl);setConsOutcomesPickerOpen(false)}} onClose={()=>setConsOutcomesPickerOpen(false)}/>}
                          </div>
                          <div style={{background:C_BG,border:`1px solid ${C_BDR}`,borderRadius:8,overflowX:"auto" as const,marginBottom:16}}>
                            <table style={{width:"100%",borderCollapse:"collapse" as const}}>
                              <thead><tr style={{background:"#1e2235"}}>
                                {["Market","Total calls","Voice-mail","%","Not relevant","%","Relevant, but not interested","%","Follow-up","%","Meeting set","%"].map((h,j)=>(
                                  <th key={j} style={{fontSize:11,fontWeight:600,padding:"10px 14px",textAlign:j===0?"left" as const:"right" as const,borderBottom:"1px solid rgba(255,255,255,.1)",background:"#1e2235",color:"#fff",whiteSpace:j===6?"normal" as const:"nowrap" as const,maxWidth:j===6?80:undefined}}>{h}</th>
                                ))}
                              </tr></thead>
                              <tbody>
                                {[{label:"Denmark",color:C_DK,bold:false},{label:"Sweden",color:C_SE,bold:false},{label:"Total",color:C_INK,bold:true}].map((r)=>(
                                  <tr key={r.label} style={{background:"#fffbeb"}}>
                                    <td style={{...TD,color:r.color,fontWeight:r.bold?700:400}}>{r.label}</td>
                                    {Array(11).fill(null).map((_,j)=>(<td key={j} style={{...TDr,color:r.bold?C_INK:C_MUTED}}>{j%2===0?"0":"0.0%"}</td>))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </>)
                      })()}

                      {/* Investment Managers — collapsible */}
                      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginTop:24,marginBottom:16,cursor:"pointer" as const,borderTop:`1px solid ${C_BDR}`,paddingTop:24}} onClick={()=>setCompassManagersOpen(v=>!v)}>
                        <h3 style={{fontSize:18,fontWeight:700,color:C_INK,margin:0,display:"flex",alignItems:"center",gap:10}}>
                          <span style={{fontSize:12,color:C_MUTED,userSelect:"none" as const}}>{compassManagersOpen?"▼":"▶"}</span>
                          Investment managers &amp; directors
                        </h3>
                        <span style={{fontSize:12,color:C_DK,fontWeight:600}}>{compassManagersOpen?"Collapse":"Expand"}</span>
                      </div>
                      {compassManagersOpen && (()=>{
                        const allMgrs=(primaryMon?.people||[]).filter((p:any)=>p.role==="manager"||p.role==="director")
                        const dkMgrs=allMgrs.filter((p:any)=>p.country==="dk")
                        const seMgrs=allMgrs.filter((p:any)=>p.country==="se")
                        const MgrRow=({p,i}:{p:any,i:number})=>(
                          <tr key={p.name} style={{background:i%2===0?C_BG:C_BDR2}}>
                            <td style={{...TD,color:C_INK,fontWeight:500}}>{p.name}</td>
                            <td style={TDr}></td><td style={TDr}></td>
                            <td style={TDr}>{fmtN(safe(p.totalCalls))}</td>
                            <td style={{...TDr,fontWeight:600}}>{fmtN(safe(p.qualityMeetings))}</td>
                            <td style={TDr}></td><td style={TDr}></td>
                            <td style={TDr}></td><td style={TDr}></td>
                            <td style={{...TDr,fontWeight:600}}>{safe(p.wonAmount)?`${fmtN(safe(p.wonAmount)/1_000_000)}M`:"—"}</td>
                            <td style={TDr}>{safe(p.reinvestment)?`${fmtN(safe(p.reinvestment)/1_000_000)}M`:"—"}</td>
                            <td style={TDr}>{pctS(safe(p.reinvestment),safe(p.wonAmount))}</td>
                            <td style={TDr}>{safe(p.newInvestments)?`${fmtN(safe(p.newInvestments)/1_000_000)}M`:"—"}</td>
                            <td style={TDr}>{pctS(safe(p.newInvestments),safe(p.wonAmount))}</td>
                          </tr>
                        )
                        const totalRow=(ppl:any[],ctry:string)=>{
                          const tot=(k:string)=>ppl.reduce((a:number,p:any)=>a+safe(p[k]),0)
                          return(<tr style={{background:C_HEAD}}>
                            <td style={{...TD,fontWeight:700,color:C_INK}}>Total {ctry}</td>
                            <td style={TDr}></td><td style={TDr}></td>
                            <td style={{...TDr,fontWeight:700}}>{fmtN(tot("totalCalls"))}</td>
                            <td style={{...TDr,fontWeight:700}}>{fmtN(tot("qualityMeetings"))}</td>
                            <td style={TDr}></td><td style={TDr}></td><td style={TDr}></td><td style={TDr}></td>
                            <td style={{...TDr,fontWeight:700}}>{fmtN(tot("wonAmount")/1_000_000)}M</td>
                            <td style={{...TDr,fontWeight:700}}>{fmtN(tot("reinvestment")/1_000_000)}M</td>
                            <td style={TDr}>{pctS(tot("reinvestment"),tot("wonAmount"))}</td>
                            <td style={{...TDr,fontWeight:700}}>{fmtN(tot("newInvestments")/1_000_000)}M</td>
                            <td style={TDr}>{pctS(tot("newInvestments"),tot("wonAmount"))}</td>
                          </tr>)
                        }
                        return(<>
                          <div style={{background:C_BG,border:`1px solid ${C_BDR}`,borderRadius:8,overflowX:"auto" as const,marginBottom:16}}>
                            <table style={{width:"100%",borderCollapse:"collapse" as const}}>
                              <thead><tr>
                                <th style={{...TH,minWidth:180}}>Investment managers &amp; directors</th>
                                <th style={THr}>Contacts</th><th style={THr}>Investors</th><th style={THr}>Total calls</th>
                                <th style={{...THr,fontWeight:700}}>Quality meetings</th>
                                <th style={{...THr,fontStyle:"italic" as const}}>Meeting booked</th><th style={THr}>%</th>
                                <th style={THr}>Meetings received</th><th style={THr}>%</th>
                                <th style={{...THr,fontWeight:700}}>Total investment</th>
                                <th style={{...THr,fontStyle:"italic" as const}}>Reinvestment</th><th style={THr}>%</th>
                                <th style={{...THr,fontStyle:"italic" as const}}>New investment</th><th style={THr}>%</th>
                              </tr></thead>
                              <tbody>
                                <tr><td colSpan={14} style={{...TD,background:C_HEAD,color:C_DK,fontWeight:700,fontSize:11,letterSpacing:".05em",textTransform:"uppercase" as const,padding:"8px 14px",borderBottom:`1px solid ${C_BDR}`}}>Denmark</td></tr>
                                {dkMgrs.length?dkMgrs.map((p:any,i:number)=><MgrRow key={p.name} p={p} i={i}/>):<tr><td colSpan={14} style={{...TD,color:C_MUTED,fontStyle:"italic" as const}}>No data</td></tr>}
                                {dkMgrs.length>0&&totalRow(dkMgrs,"DK")}
                                <tr><td colSpan={14} style={{...TD,background:C_HEAD,color:C_SE,fontWeight:700,fontSize:11,letterSpacing:".05em",textTransform:"uppercase" as const,padding:"8px 14px",borderTop:`2px solid ${C_BDR}`,borderBottom:`1px solid ${C_BDR}`}}>Sweden</td></tr>
                                {seMgrs.length?seMgrs.map((p:any,i:number)=><MgrRow key={p.name} p={p} i={i}/>):<tr><td colSpan={14} style={{...TD,color:C_MUTED,fontStyle:"italic" as const}}>No data</td></tr>}
                                {seMgrs.length>0&&totalRow(seMgrs,"SE")}
                              </tbody>
                            </table>
                          </div>
                          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",margin:"28px 0 12px"}}>
                            <h3 style={{fontSize:16,fontWeight:700,color:C_INK,margin:0}}>Meeting data</h3>
                            <button onClick={()=>setMgrMeetingPickerOpen(v=>!v)}
                              style={{display:"flex",alignItems:"center",gap:6,padding:"5px 12px",fontSize:11,fontWeight:500,border:`1px solid ${C_BDR}`,borderRadius:6,background:C_BG,color:C_INK,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap" as const}}>
                              <span>📅</span><span>{mgrMeetingLabel}</span><span style={{color:C_MUTED,fontSize:9}}>▼</span>
                            </button>
                            {mgrMeetingPickerOpen && <FBDatePicker onApply={(lbl)=>{setMgrMeetingLabel(lbl);setMgrMeetingPickerOpen(false)}} onClose={()=>setMgrMeetingPickerOpen(false)}/>}
                          </div>
                          <div style={{background:C_BG,border:`1px solid ${C_BDR}`,borderRadius:8,overflowX:"auto" as const,marginBottom:24}}>
                            <table style={{width:"100%",borderCollapse:"collapse" as const}}>
                              <thead>
                                <tr>
                                  <th style={{...TH,minWidth:140}} colSpan={2}>Meetings data on new investors</th>
                                  {["Disqualified","%","No show / Cancellation","%","Not interested","%","Not currently liquid","%","Interested","%","Deal sent","%","Deal Won","%"].map((h,j)=>(<th key={j} style={THr}>{h}</th>))}
                                </tr>
                                <tr>
                                  <th style={{...TH,borderTop:"none"}}>Outcomes</th>
                                  <th style={{...THr,borderTop:"none"}}>Total meetings</th>
                                  <th style={{...THr,borderTop:"none"}}></th><th style={{...THr,borderTop:"none"}}></th>
                                  <th style={{...THr,borderTop:"none",fontSize:9,color:"#92400e",background:"#fffbeb"}}>Input directly after the meeting</th>
                                  {Array(11).fill(null).map((_,j)=><th key={j} style={{...THr,borderTop:"none"}}></th>)}
                                </tr>
                              </thead>
                              <tbody>
                                {["Denmark","Sweden"].map((r,i)=>(
                                  <tr key={r} style={{background:i%2===0?C_BG:C_BDR2}}>
                                    <td style={TD}>{r}</td>
                                    {Array(15).fill(null).map((_,j)=><td key={j} style={TDr}></td>)}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </>)
                      })()}

                      {/* ── Vaekstkapital Analytics ─────────────────────────── */}
                      <div style={{borderTop:`1px solid ${C_BDR}`,paddingTop:28,marginTop:16}}>
                        <div style={{fontSize:11,fontWeight:700,letterSpacing:".07em",textTransform:"uppercase" as const,color:C_MUTED,marginBottom:16}}>Investor analytics</div>

                        {/* LTI Cohort */}
                        <h3 style={{fontSize:16,fontWeight:700,color:C_INK,margin:"0 0 12px"}}>Life time investment cohort</h3>
                        <div style={{fontSize:11,color:C_MUTED,marginBottom:10}}>Each row = customers acquired in that quarter. Q0 = acquisition quarter, Q1 = one quarter later, etc. Cell value = number of deals from that cohort in that quarter offset.</div>
                        {(()=>{
                          const cohort=(compassData.ltiCohort||[]) as Array<{quarter:string;customers:number;deals:number[];amounts:number[]}>
                          const maxDeals=Math.max(1,...cohort.flatMap(r=>r.deals))
                          return(
                          <div style={{background:C_BG,border:`1px solid ${C_BDR}`,borderRadius:8,overflowX:"auto" as const,marginBottom:28}}>
                            <table style={{width:"100%",borderCollapse:"collapse" as const}}>
                              <thead><tr style={{background:C_HEAD}}>
                                <th style={{...TH,minWidth:130}}>Acquisition quarter</th>
                                <th style={THr}>Customers</th>
                                {Array(16).fill(null).map((_,j)=>(
                                  <th key={j} style={{...THr,fontSize:10,color:C_MUTED}}>Q+{j}</th>
                                ))}
                              </tr></thead>
                              <tbody>
                                {cohort.map((row,i)=>(
                                  <tr key={row.quarter} style={{background:i%2===0?C_BG:C_BDR2}}>
                                    <td style={{...TD,fontWeight:600}}>{row.quarter}</td>
                                    <td style={{...TDr,fontWeight:700,color:C_DK}}>{row.customers||""}</td>
                                    {row.deals.map((d,j)=>{
                                      const intensity=d>0?Math.min(d/maxDeals,1):0
                                      return(
                                        <td key={j} title={d>0?`${d} deals · ${fmtN(Math.round((row.amounts[j]||0)/1_000_000))}M DKK`:""}
                                          style={{...TDr,background:d>0?`rgba(29,78,216,${(intensity*0.35+0.05).toFixed(2)})`:"",color:intensity>0.5?"#fff":d>0?C_DK:"",fontWeight:d>0?600:undefined,fontSize:11}}>
                                          {d>0?d:""}
                                        </td>
                                      )
                                    })}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          )
                        })()}

                        {/* Value to Cost — by grade */}
                        <h3 style={{fontSize:16,fontWeight:700,color:C_INK,margin:"0 0 6px"}}>Value to cost, by grade</h3>
                        <div style={{fontSize:11,color:C_MUTED,marginBottom:10}}>Grade = wealth tier. LTI = raw investment total, Vaekstkapital only.</div>
                        <div style={{background:C_BG,border:`1px solid ${C_BDR}`,borderRadius:8,overflowX:"auto" as const,marginBottom:24}}>
                          <table style={{width:"100%",borderCollapse:"collapse" as const}}>
                            <thead><tr>
                              <th style={TH}>Grade</th>
                              {["Meetings held","Deal Won (invested)","Close rate %","Marketing cost","Consultant cost","Meeting cost","Events cost","Tour cost","Total cost","LTI1","Cost ratio 1","LTI12","Cost ratio 12","LTI24","Cost ratio 24"].map((h,j)=>(
                                <th key={j} style={THr}>{h}</th>
                              ))}
                            </tr></thead>
                            <tbody>
                              {["EXAMPLE","Grade A","Grade B","Grade C","Grade D","Total"].map((r,i)=>(
                                <tr key={r} style={{background:r==="Total"?C_HEAD:i%2===0?C_BG:C_BDR2}}>
                                  <td style={{...TD,fontWeight:r==="Total"?700:400,color:r==="EXAMPLE"?"#92400e":r==="Total"?C_INK:C_INK}}>{r}</td>
                                  {Array(15).fill(null).map((_,j)=><td key={j} style={{...TDr,fontWeight:r==="Total"?700:400}}></td>)}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        {/* Value to Cost — by source */}
                        <h3 style={{fontSize:16,fontWeight:700,color:C_INK,margin:"0 0 6px"}}>Value to cost, by source</h3>
                        <div style={{background:C_BG,border:`1px solid ${C_BDR}`,borderRadius:8,overflowX:"auto" as const,marginBottom:24}}>
                          <table style={{width:"100%",borderCollapse:"collapse" as const}}>
                            <thead><tr>
                              <th style={TH}>Source</th>
                              {["Meetings held","Deal Won (invested)","Close rate %","Marketing cost","Consultant cost","Meeting cost","Events cost","Tour cost","Total cost","LTI1","Cost ratio 1","LTI12","Cost ratio 12","LTI24","Cost ratio 24"].map((h,j)=>(
                                <th key={j} style={THr}>{h}</th>
                              ))}
                            </tr></thead>
                            <tbody>
                              {["EXAMPLE","Cold calling","Marketing","VaekstNet","Reinvesting","Total"].map((r,i)=>(
                                <tr key={r} style={{background:r==="Total"?C_HEAD:i%2===0?C_BG:C_BDR2}}>
                                  <td style={{...TD,fontWeight:r==="Total"?700:400,color:r==="EXAMPLE"?"#92400e":C_INK}}>{r}</td>
                                  {Array(15).fill(null).map((_,j)=><td key={j} style={{...TDr,fontWeight:r==="Total"?700:400}}></td>)}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        {/* Value to Cost — by tour participant */}
                        <h3 style={{fontSize:16,fontWeight:700,color:C_INK,margin:"0 0 6px"}}>Value to cost, by tour participant</h3>
                        <div style={{background:C_BG,border:`1px solid ${C_BDR}`,borderRadius:8,overflowX:"auto" as const,marginBottom:24}}>
                          <table style={{width:"100%",borderCollapse:"collapse" as const}}>
                            <thead><tr>
                              <th style={TH}>Age group</th>
                              {["Meetings held","Deal Won (invested)","Close rate %","Marketing cost","Consultant cost","Meeting cost","Events cost","Tour cost","Total cost","LTI1","Cost ratio 1","LTI12","Cost ratio 12","LTI24","Cost ratio 24"].map((h,j)=>(
                                <th key={j} style={THr}>{h}</th>
                              ))}
                            </tr></thead>
                            <tbody>
                              {["EXAMPLE","<35","35-44","45-54","55-64","65+","Total"].map((r,i)=>(
                                <tr key={r} style={{background:r==="Total"?C_HEAD:i%2===0?C_BG:C_BDR2}}>
                                  <td style={{...TD,fontWeight:r==="Total"?700:400,color:r==="EXAMPLE"?"#92400e":C_INK}}>{r}</td>
                                  {Array(15).fill(null).map((_,j)=><td key={j} style={{...TDr,fontWeight:r==="Total"?700:400}}></td>)}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        {/* Value to Cost — by meeting type */}
                        <h3 style={{fontSize:16,fontWeight:700,color:C_INK,margin:"0 0 6px"}}>Value to cost, by meeting type</h3>
                        <div style={{background:C_BG,border:`1px solid ${C_BDR}`,borderRadius:8,overflowX:"auto" as const,marginBottom:24}}>
                          <table style={{width:"100%",borderCollapse:"collapse" as const}}>
                            <thead><tr>
                              <th style={TH}>Meeting type</th>
                              {["Meetings held","Deal Won (invested)","Close rate %","Marketing cost","Consultant cost","Meeting cost","Events cost","Tour cost","Total cost","LTI1","Cost ratio 1","LTI12","Cost ratio 12","LTI24","Cost ratio 24"].map((h,j)=>(
                                <th key={j} style={THr}>{h}</th>
                              ))}
                            </tr></thead>
                            <tbody>
                              {["EXAMPLE","Online","Physical (at office)","Physical (away)","Total"].map((r,i)=>(
                                <tr key={r} style={{background:r==="Total"?C_HEAD:i%2===0?C_BG:C_BDR2}}>
                                  <td style={{...TD,fontWeight:r==="Total"?700:400,color:r==="EXAMPLE"?"#92400e":C_INK}}>{r}</td>
                                  {Array(15).fill(null).map((_,j)=><td key={j} style={{...TDr,fontWeight:r==="Total"?700:400}}></td>)}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        {/* Investor profile */}
                        <h3 style={{fontSize:16,fontWeight:700,color:C_INK,margin:"0 0 6px"}}>Investor profile &amp; data</h3>
                        <div style={{fontSize:11,fontWeight:700,color:C_MUTED,letterSpacing:".05em",marginBottom:8}}>Age / Demographics</div>
                        <div style={{background:C_BG,border:`1px solid ${C_BDR}`,borderRadius:8,overflowX:"auto" as const,marginBottom:16,maxWidth:560}}>
                          <table style={{width:"100%",borderCollapse:"collapse" as const}}>
                            <thead><tr>
                              <th style={TH}>Age group</th><th style={THr}>Count</th><th style={THr}>% of total</th><th style={THr}>Investment volume</th><th style={THr}>% of total</th><th style={THr}>LTI1</th><th style={THr}>LTI12</th>
                            </tr></thead>
                            <tbody>
                              {["<35","35-44","45-54","55-64","65+"].map((r,i)=>(
                                <tr key={r} style={{background:i%2===0?C_BG:C_BDR2}}>
                                  <td style={TD}>{r}</td>{Array(6).fill(null).map((_,j)=><td key={j} style={TDr}></td>)}
                                </tr>
                              ))}
                              <tr style={{background:C_HEAD}}><td style={{...TD,fontWeight:700}}>Total</td>{Array(6).fill(null).map((_,j)=><td key={j} style={{...TDr,fontWeight:700}}></td>)}</tr>
                            </tbody>
                          </table>
                        </div>
                        <div style={{fontSize:11,fontWeight:700,color:C_MUTED,letterSpacing:".05em",marginBottom:8,marginTop:16}}>Reinvestment rate (12-month)</div>
                        <div style={{background:C_BG,border:`1px solid ${C_BDR}`,borderRadius:8,overflowX:"auto" as const,marginBottom:16,maxWidth:400}}>
                          <table style={{width:"100%",borderCollapse:"collapse" as const}}>
                            <thead><tr>
                              <th style={TH}>Grade</th><th style={THr}>First investors (cohort)</th><th style={THr}>Reinvested within 12mo</th><th style={THr}>Reinvestment rate %</th>
                            </tr></thead>
                            <tbody>
                              {["Grade A","Grade B","Grade C","Grade D"].map((r,i)=>(
                                <tr key={r} style={{background:i%2===0?C_BG:C_BDR2}}>
                                  <td style={TD}>{r}</td>{Array(3).fill(null).map((_,j)=><td key={j} style={TDr}></td>)}
                                </tr>
                              ))}
                              <tr style={{background:C_HEAD}}><td style={{...TD,fontWeight:700}}>Total</td>{Array(3).fill(null).map((_,j)=><td key={j} style={{...TDr,fontWeight:700}}></td>)}</tr>
                            </tbody>
                          </table>
                        </div>

                        {/* Converting rates to AIF */}
                        <h3 style={{fontSize:16,fontWeight:700,color:C_INK,margin:"24px 0 6px"}}>Converting rates to AIF</h3>
                        <div style={{background:C_BG,border:`1px solid ${C_BDR}`,borderRadius:8,overflowX:"auto" as const,marginBottom:32,maxWidth:440}}>
                          <table style={{width:"100%",borderCollapse:"collapse" as const}}>
                            <thead><tr>
                              <th style={TH}>Metric</th><th style={THr}>Count</th><th style={THr}>Rate %</th>
                            </tr></thead>
                            <tbody>
                              {["Investors without AIF","Time from investor to investor with AIF (days)","Conversion rate"].map((r,i)=>(
                                <tr key={r} style={{background:i%2===0?C_BG:C_BDR2}}>
                                  <td style={TD}>{r}</td><td style={TDr}></td><td style={TDr}></td>
                                </tr>
                              ))}
                              <tr style={{background:C_HEAD}}><td style={{...TD,fontWeight:700}}>Total</td><td style={{...TDr,fontWeight:700}}></td><td style={{...TDr,fontWeight:700}}></td></tr>
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </>)}

                    {/* ── VaekstNet section ──────────────────────────────────── */}
                    {compassOverviewSection==="vaekstnet" && (()=>{
                      const aucD=compassData.auc
                      const fmtM=(v:number)=>v>=1_000_000?`${(v/1_000_000).toFixed(1)}M`:`${(v/1_000).toFixed(0)}k`
                      return(<>
                      {/* Assets under custody */}
                      <div style={{fontSize:11,fontWeight:700,letterSpacing:".07em",textTransform:"uppercase" as const,color:C_MUTED,marginBottom:8,marginTop:8}}>Assets under custody (AUC)</div>
                      <div style={{fontSize:11,color:C_MUTED,marginBottom:10,fontStyle:"italic" as const}}>Total AUC across all VaekstNet investors (contacts + companies). "New" and "In transit" require period-aware data not yet available.</div>
                      <div style={{background:C_BG,border:`1px solid ${C_BDR}`,borderRadius:8,overflowX:"auto" as const,marginBottom:24,maxWidth:520}}>
                        <table style={{width:"100%",borderCollapse:"collapse" as const}}>
                          <thead><tr>
                            <th style={TH}>Category</th><th style={THr}>New</th><th style={THr}>In transit</th><th style={THr}>Total</th>
                          </tr></thead>
                          <tbody>
                            {([["Cash", aucD?.cash ?? null],["VK Funds", aucD?.vkFunds ?? null],["Securities (listed)", aucD ? Math.max(0, aucD.total - aucD.vkFunds - aucD.cash) : null]] as const).map(([r,v]:any,i:number)=>(
                              <tr key={r} style={{background:i%2===0?C_BG:C_BDR2}}>
                                <td style={TD}>{r}</td>
                                <td style={{...TDr,color:C_MUTED,fontStyle:"italic" as const}}>—</td>
                                <td style={{...TDr,color:C_MUTED,fontStyle:"italic" as const}}>—</td>
                                <td style={{...TDr,fontWeight:600}}>{v!=null?fmtM(v):"—"}</td>
                              </tr>
                            ))}
                            <tr style={{background:C_HEAD}}>
                              <td style={{...TD,fontWeight:700}}>Total</td>
                              <td style={{...TDr}}></td><td style={{...TDr}}></td>
                              <td style={{...TDr,fontWeight:700,color:C_INK}}>{aucD?fmtM(aucD.total):"—"}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      {/* Investors on platform */}
                      <div style={{fontSize:11,fontWeight:700,letterSpacing:".07em",textTransform:"uppercase" as const,color:C_MUTED,marginBottom:8,marginTop:24}}>Investors on the platform</div>
                      <div style={{background:C_BG,border:`1px solid ${C_BDR}`,borderRadius:8,overflowX:"auto" as const,marginBottom:24,maxWidth:480}}>
                        <table style={{width:"100%",borderCollapse:"collapse" as const}}>
                          <thead><tr>
                            <th style={TH}>Category</th><th style={THr}>Count</th><th style={THr}>Volume</th><th style={THr}>Conversion rate %</th>
                          </tr></thead>
                          <tbody>
                            <tr style={{background:C_BG}}>
                              <td style={TD}>VaekstNet app users (with AUC)</td>
                              <td style={{...TDr,fontWeight:600}}>{fmtN(aucD?.investorsOnPlatform??0)}</td>
                              <td style={TDr}>{aucD?fmtM(aucD.total):"—"}</td>
                              <td style={TDr}></td>
                            </tr>
                            {["Good marketing contacts","Testing-fase","Investors (+5 mio)","Investor without AIF","Investor with AIF"].map((r,i)=>(
                              <tr key={r} style={{background:(i+1)%2===0?C_BG:C_BDR2}}>
                                <td style={TD}>{r}</td><td style={TDr}></td><td style={TDr}></td><td style={TDr}></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Top 25 investors */}
                      <div style={{fontSize:11,fontWeight:700,letterSpacing:".07em",textTransform:"uppercase" as const,color:C_MUTED,marginBottom:8,marginTop:24}}>Top 25 investors — total AUC</div>
                      <div style={{background:C_BG,border:`1px solid ${C_BDR}`,borderRadius:8,overflowX:"auto" as const,marginBottom:24}}>
                        <table style={{width:"100%",borderCollapse:"collapse" as const}}>
                          <thead><tr>
                            <th style={{...THr,textAlign:"left" as const,minWidth:32}}>Rank</th>
                            <th style={{...TH,minWidth:180}}>Investor</th>
                            <th style={THr}>Type</th>
                            <th style={THr}>Consultant</th>
                            <th style={{...THr,fontWeight:700}}>Total AUC</th>
                            <th style={THr}>VK Funds</th>
                            <th style={THr}>Cash</th>
                          </tr></thead>
                          <tbody>
                            {(aucD?.top25||[]).map((c:any,i:number)=>(
                              <tr key={i} style={{background:i%2===0?C_BG:C_BDR2}}>
                                <td style={{...TDr,color:C_MUTED,fontWeight:600}}>{i+1}</td>
                                <td style={{...TD,fontWeight:500}}>{c.name}</td>
                                <td style={{...TDr,color:C_MUTED,fontSize:11}}>{c.type}</td>
                                <td style={{...TDr,color:C_MUTED,fontSize:11}}>{c.consultant}</td>
                                <td style={{...TDr,fontWeight:700,color:C_INK}}>{fmtM(c.totalAuc)}</td>
                                <td style={TDr}>{fmtM(c.vkFunds)}</td>
                                <td style={TDr}>{fmtM(c.cash)}</td>
                              </tr>
                            ))}
                            {(!aucD?.top25?.length)&&<tr><td colSpan={7} style={{...TD,color:C_MUTED,fontStyle:"italic" as const}}>No AUC data — loading…</td></tr>}
                          </tbody>
                        </table>
                      </div>

                      {/* Wealth managers */}
                      <div style={{fontSize:11,fontWeight:700,letterSpacing:".07em",textTransform:"uppercase" as const,color:C_MUTED,marginBottom:8,marginTop:24}}>Wealth managers</div>
                      <div style={{background:C_BG,border:`1px solid ${C_BDR}`,borderRadius:8,overflowX:"auto" as const,marginBottom:24}}>
                        <table style={{width:"100%",borderCollapse:"collapse" as const}}>
                          <thead><tr>
                            <th style={TH}>Name</th><th style={THr}>Contacts</th><th style={THr}>Investors</th><th style={THr}>New AUC</th><th style={THr}>Meeting set for AIF</th><th style={THr}>New AIF investments</th>
                          </tr></thead>
                          <tbody>
                            {Array(4).fill("[Name]").map((n,i)=>(
                              <tr key={i} style={{background:i%2===0?C_BG:C_BDR2}}>
                                <td style={TD}>{n}</td>{Array(5).fill(null).map((_,j)=><td key={j} style={TDr}></td>)}
                              </tr>
                            ))}
                            <tr style={{background:C_HEAD}}>
                              <td style={{...TD,fontWeight:700}}>Total</td>{Array(5).fill(null).map((_,j)=><td key={j} style={{...TDr,fontWeight:700}}></td>)}
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      {/* Marketing / Performance ads */}
                      <div style={{fontSize:11,fontWeight:700,letterSpacing:".07em",textTransform:"uppercase" as const,color:C_MUTED,marginBottom:8,marginTop:24}}>Marketing — performance ads</div>
                      <div style={{background:C_BG,border:`1px solid ${C_BDR}`,borderRadius:8,overflowX:"auto" as const,marginBottom:16}}>
                        <table style={{width:"100%",borderCollapse:"collapse" as const}}>
                          <thead><tr>
                            <th style={TH}>Channel</th><th style={THr}>Spend</th><th style={THr}>Leads</th><th style={THr}>Cost per lead</th><th style={THr}>Testing-fase</th><th style={THr}>Cost per investor</th>
                          </tr></thead>
                          <tbody>
                            {["Meta","Google","LinkedIn"].map((r,i)=>(
                              <tr key={r} style={{background:i%2===0?C_BG:C_BDR2}}>
                                <td style={TD}>{r}</td>{Array(5).fill(null).map((_,j)=><td key={j} style={TDr}></td>)}
                              </tr>
                            ))}
                            <tr style={{background:C_HEAD}}>
                              <td style={{...TD,fontWeight:700}}>Total</td>{Array(5).fill(null).map((_,j)=><td key={j} style={{...TDr,fontWeight:700}}></td>)}
                            </tr>
                          </tbody>
                        </table>
                      </div>
                      <div style={{fontSize:11,fontWeight:700,letterSpacing:".07em",textTransform:"uppercase" as const,color:C_MUTED,marginBottom:8,marginTop:24}}>Lead output — reasons for not converting</div>
                      <div style={{background:C_BG,border:`1px solid ${C_BDR}`,borderRadius:8,overflowX:"auto" as const,marginBottom:32,maxWidth:340}}>
                        <table style={{width:"100%",borderCollapse:"collapse" as const}}>
                          <thead><tr><th style={TH}>Reason</th><th style={THr}>Count</th><th style={THr}>% of total</th></tr></thead>
                          <tbody>
                            {["Disqualified","Bad timing","Not worth it","Features missing"].map((r,i)=>(
                              <tr key={r} style={{background:i%2===0?C_BG:C_BDR2}}>
                                <td style={TD}>{r}</td><td style={TDr}></td><td style={TDr}></td>
                              </tr>
                            ))}
                            <tr style={{background:C_HEAD}}><td style={{...TD,fontWeight:700}}>Total</td><td style={{...TDr,fontWeight:700}}></td><td style={{...TDr,fontWeight:700}}></td></tr>
                          </tbody>
                        </table>
                      </div>
                    </>)
                    })()}
                  </div>
                </div>

            </div>
          )
        })()}
        </div>{/* /compass-region */}

      </main>

      <footer>
        <span>Live · HubSpot API · Last fetched: {fetchedAt}</span>
        <span style={{color:"rgba(255,255,255,.2)"}}>Internal test users excluded · Scrive: DK only</span>
      </footer>

      {pipelineModal && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.55)",zIndex:1000,display:"flex",alignItems:"flex-end",justifyContent:"center"}} onClick={() => setPipelineModal(null)}>
          <div style={{background:"var(--bei)",borderRadius:"12px 12px 0 0",width:"100%",maxWidth:720,maxHeight:"80vh",display:"flex",flexDirection:"column",boxShadow:"0 -4px 32px rgba(0,0,0,.25)"}} onClick={e => e.stopPropagation()}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"16px 20px 12px",borderBottom:"1px solid var(--bdr)",flexShrink:0}}>
              <span style={{fontSize:13,fontWeight:700,color:"var(--ink1)"}}>{pipelineModal.title}</span>
              <button onClick={() => setPipelineModal(null)} style={{background:"none",border:"none",cursor:"pointer",fontSize:20,color:"var(--ink3)",lineHeight:1,padding:"0 4px",fontFamily:"inherit"}}>×</button>
            </div>
            <div style={{overflowY:"auto",flex:1}}>
              <table style={{width:"100%",borderCollapse:"collapse"}}>
                <thead style={{position:"sticky",top:0,background:"var(--bei)",zIndex:1}}>
                  <tr>
                    <th style={{...th,padding:"8px 20px"}}>Deal</th>
                    <th style={{...th,padding:"8px 20px"}}>Pipeline</th>
                    <th style={{...th,padding:"8px 20px",textAlign:"right" as const}}>Amount</th>
                    <th style={{...th,padding:"8px 20px"}}>Owner</th>
                    <th style={{...th,padding:"8px 20px"}}>Close Date</th>
                  </tr>
                </thead>
                <tbody>
                  {pipelineModal.deals.map((d: any, i: number) => (
                    <tr key={d.id || i}>
                      <td style={{...td,padding:"8px 20px"}}>
                        <a href={`https://app.hubspot.com/contacts/${PORTAL}/deal/${d.id}`} target="_blank" rel="noopener noreferrer" style={{color:"var(--blu)",textDecoration:"none",fontWeight:500}}>{d.name}</a>
                      </td>
                      <td style={{...td,padding:"8px 20px",color:"var(--ink3)",fontSize:11}}>{d.pipeline || "—"}</td>
                      <td style={{...tdr,padding:"8px 20px",fontSize:12}}>{d.amount > 0 ? (pipelineModal.fmtAmt ?? fmt)(d.amount) : "—"}</td>
                      <td style={{...td,padding:"8px 20px",color:"var(--ink3)",fontSize:11}}>{d.owner || "—"}</td>
                      <td style={{...td,padding:"8px 20px",color:"var(--ink3)",fontSize:11}}>{d.closedate ? new Date(d.closedate).toLocaleDateString("da-DK") : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function Dashboard() {
  return <Suspense><DashboardInner /></Suspense>
}
