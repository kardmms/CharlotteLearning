import { NextResponse } from "next/server";
import { Prisma, SchoolDirectorySource } from "@prisma/client";
import { prisma } from "@/lib/db";
import { restrictedFetch } from "@/lib/outbound";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NCES_PUBLIC_SCHOOL_LAYER =
  "https://nces.ed.gov/opengis/rest/services/K12_School_Locations/EDGE_GEOCODE_PUBLICSCH_2425/MapServer/0/query";

type SchoolSearchResult = {
  id: string;
  ncesSchoolId: string | null;
  name: string;
  districtName: string | null;
  street: string | null;
  city: string;
  state: string;
  zip: string | null;
  source: string;
  sourceYear: string;
};

type NcesFeature = {
  attributes?: {
    NCESSCH?: string | null;
    LEAID?: string | null;
    NAME?: string | null;
    STREET?: string | null;
    CITY?: string | null;
    STATE?: string | null;
    ZIP?: string | null;
    NMCNTY?: string | null;
    LAT?: number | null;
    LON?: number | null;
    SCHOOLYEAR?: string | null;
  };
};

function cleanQuery(value: string) {
  return value
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}\s.'-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

function normalizeSearchText(parts: Array<string | null | undefined>) {
  return parts
    .filter((part): part is string => Boolean(part?.trim()))
    .join(" ")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function ncesWhereClause(query: string) {
  const safe = query.toUpperCase().replace(/'/g, "''");
  const zipPrefix = query.replace(/\D/g, "").slice(0, 5);
  const clauses = [
    `UPPER(NAME) LIKE '%${safe}%'`,
    `UPPER(CITY) LIKE '%${safe}%'`
  ];
  if (zipPrefix.length >= 2) {
    clauses.push(`ZIP LIKE '${zipPrefix}%'`);
  }
  return clauses.join(" OR ");
}

async function searchLocalSchools(query: string, normalized: string): Promise<SchoolSearchResult[]> {
  const zipPrefix = query.replace(/\D/g, "").slice(0, 5);
  const likeQuery = `%${normalized}%`;
  const prefixQuery = `${normalized}%`;
  const zipLike = zipPrefix.length >= 2 ? `${zipPrefix}%` : "";

  return prisma.$queryRaw<SchoolSearchResult[]>(Prisma.sql`
    SELECT
      "id",
      "ncesSchoolId",
      "name",
      "districtName",
      "street",
      "city",
      "state",
      "zip",
      "source"::text AS "source",
      "sourceYear"
    FROM "SchoolDirectory"
    WHERE
      "searchText" ILIKE ${likeQuery}
      OR (${zipLike} <> '' AND "zip" LIKE ${zipLike})
    ORDER BY
      CASE
        WHEN LOWER("name") = ${normalized} THEN 0
        WHEN LOWER("name") LIKE ${prefixQuery} THEN 1
        WHEN LOWER("city") = ${normalized} THEN 2
        WHEN "zip" LIKE ${zipLike} THEN 3
        ELSE 4
      END,
      "state" ASC,
      "city" ASC,
      "name" ASC
    LIMIT 12
  `);
}

async function searchNcesFallback(query: string): Promise<SchoolSearchResult[]> {
  const url = new URL(NCES_PUBLIC_SCHOOL_LAYER);
  url.searchParams.set("where", ncesWhereClause(query));
  url.searchParams.set("outFields", "NCESSCH,LEAID,NAME,STREET,CITY,STATE,ZIP,NMCNTY,LAT,LON,SCHOOLYEAR");
  url.searchParams.set("returnGeometry", "false");
  url.searchParams.set("orderByFields", "STATE ASC,CITY ASC,NAME ASC");
  url.searchParams.set("resultRecordCount", "12");
  url.searchParams.set("f", "json");

  const response = await restrictedFetch(url, {
    headers: { accept: "application/json" },
    next: { revalidate: 60 * 60 * 24 }
  });
  if (!response.ok) return [];

  const payload = (await response.json()) as { features?: NcesFeature[] };
  return (payload.features || []).flatMap((feature) => {
    const row = feature.attributes;
    if (!row?.NCESSCH || !row.NAME || !row.CITY || !row.STATE) return [];
    return [{
      id: `nces-public:${row.NCESSCH}`,
      ncesSchoolId: row.NCESSCH,
      name: row.NAME,
      districtName: null,
      street: row.STREET || null,
      city: row.CITY,
      state: row.STATE,
      zip: row.ZIP || null,
      source: SchoolDirectorySource.NCES_PUBLIC,
      sourceYear: row.SCHOOLYEAR || "2024-2025"
    }];
  });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = cleanQuery(url.searchParams.get("q") || "");
  const normalized = normalizeSearchText([query]);
  if (query.length < 2 || normalized.length < 2) {
    return NextResponse.json({ schools: [] });
  }

  const schools = await searchLocalSchools(query, normalized);
  if (schools.length > 0) {
    return NextResponse.json({ schools });
  }

  const hasLocalDirectory = await prisma.schoolDirectory.findFirst({
    select: { id: true }
  });
  if (hasLocalDirectory) {
    return NextResponse.json({ schools: [] });
  }

  return NextResponse.json({ schools: await searchNcesFallback(query) });
}
