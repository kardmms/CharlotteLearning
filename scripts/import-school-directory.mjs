import crypto from "node:crypto";
import { Prisma, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const PUBLIC_SCHOOL_LAYER =
  process.env.NCES_PUBLIC_SCHOOL_LAYER_URL ||
  "https://nces.ed.gov/opengis/rest/services/K12_School_Locations/EDGE_GEOCODE_PUBLICSCH_2425/MapServer/0/query";
const PUBLIC_DISTRICT_LAYER =
  process.env.NCES_PUBLIC_DISTRICT_LAYER_URL ||
  "https://nces.ed.gov/opengis/rest/services/K12_School_Locations/EDGE_GEOCODE_PUBLICLEA_2425/MapServer/0/query";
const SOURCE = "NCES_PUBLIC";
const DEFAULT_SOURCE_YEAR = "2024-2025";
const PAGE_SIZE = 2000;
const UPSERT_SIZE = 500;
const MAX_RECORDS = Number.parseInt(process.env.SCHOOL_DIRECTORY_IMPORT_LIMIT || "0", 10) || 0;

function text(value, maxLength = 500) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function nullableText(value, maxLength = 500) {
  const clean = text(value, maxLength);
  return clean || null;
}

function nullableNumber(value) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function searchText(parts) {
  return parts
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchFeaturePage(layerUrl, outFields, offset) {
  const url = new URL(layerUrl);
  url.searchParams.set("where", "1=1");
  url.searchParams.set("outFields", outFields);
  url.searchParams.set("returnGeometry", "false");
  url.searchParams.set("orderByFields", "OBJECTID ASC");
  url.searchParams.set("resultOffset", String(offset));
  url.searchParams.set("resultRecordCount", String(PAGE_SIZE));
  url.searchParams.set("f", "json");

  const response = await fetch(url, { headers: { accept: "application/json" } });
  if (!response.ok) {
    throw new Error(`NCES request failed (${response.status}) for ${url}`);
  }
  const payload = await response.json();
  if (payload.error) {
    throw new Error(`NCES request failed: ${payload.error.message || JSON.stringify(payload.error)}`);
  }
  return payload.features || [];
}

async function fetchDistrictNames() {
  const districtNames = new Map();
  let offset = 0;

  while (true) {
    const page = await fetchFeaturePage(PUBLIC_DISTRICT_LAYER, "LEAID,NAME", offset);
    for (const feature of page) {
      const districtId = text(feature.attributes?.LEAID, 40);
      const districtName = nullableText(feature.attributes?.NAME, 180);
      if (districtId && districtName) districtNames.set(districtId, districtName);
    }
    if (page.length < PAGE_SIZE) break;
    offset += page.length;
  }

  return districtNames;
}

async function upsertSchoolDirectoryRows(rows) {
  if (rows.length === 0) return;

  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO "SchoolDirectory" (
      "id",
      "source",
      "externalId",
      "ncesSchoolId",
      "ncesDistrictId",
      "name",
      "districtName",
      "street",
      "city",
      "state",
      "zip",
      "countyName",
      "locale",
      "latitude",
      "longitude",
      "sourceYear",
      "searchText",
      "createdAt",
      "updatedAt"
    )
    VALUES ${Prisma.join(
      rows.map((row) => Prisma.sql`(
        ${row.id},
        ${row.source}::"SchoolDirectorySource",
        ${row.externalId},
        ${row.ncesSchoolId},
        ${row.ncesDistrictId},
        ${row.name},
        ${row.districtName},
        ${row.street},
        ${row.city},
        ${row.state},
        ${row.zip},
        ${row.countyName},
        ${row.locale},
        ${row.latitude},
        ${row.longitude},
        ${row.sourceYear},
        ${row.searchText},
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )`)
    )}
    ON CONFLICT ("source", "externalId") DO UPDATE SET
      "ncesSchoolId" = EXCLUDED."ncesSchoolId",
      "ncesDistrictId" = EXCLUDED."ncesDistrictId",
      "name" = EXCLUDED."name",
      "districtName" = EXCLUDED."districtName",
      "street" = EXCLUDED."street",
      "city" = EXCLUDED."city",
      "state" = EXCLUDED."state",
      "zip" = EXCLUDED."zip",
      "countyName" = EXCLUDED."countyName",
      "locale" = EXCLUDED."locale",
      "latitude" = EXCLUDED."latitude",
      "longitude" = EXCLUDED."longitude",
      "sourceYear" = EXCLUDED."sourceYear",
      "searchText" = EXCLUDED."searchText",
      "updatedAt" = CURRENT_TIMESTAMP
  `);
}

function rowFromSchoolFeature(feature, districtNames) {
  const attributes = feature.attributes || {};
  const ncesSchoolId = text(attributes.NCESSCH, 40);
  const ncesDistrictId = nullableText(attributes.LEAID, 40);
  const name = text(attributes.NAME, 180);
  const city = text(attributes.CITY, 100);
  const state = text(attributes.STATE, 2).toUpperCase();
  if (!ncesSchoolId || !name || !city || !state) return null;

  const districtName = ncesDistrictId ? districtNames.get(ncesDistrictId) || null : null;
  const street = nullableText(attributes.STREET, 180);
  const zip = nullableText(attributes.ZIP, 20);
  const countyName = nullableText(attributes.NMCNTY, 120);
  const locale = nullableText(attributes.LOCALE, 80);
  const sourceYear = text(attributes.SCHOOLYEAR, 20) || DEFAULT_SOURCE_YEAR;

  return {
    id: crypto.randomUUID(),
    source: SOURCE,
    externalId: ncesSchoolId,
    ncesSchoolId,
    ncesDistrictId,
    name,
    districtName,
    street,
    city,
    state,
    zip,
    countyName,
    locale,
    latitude: nullableNumber(attributes.LAT),
    longitude: nullableNumber(attributes.LON),
    sourceYear,
    searchText: searchText([ncesSchoolId, ncesDistrictId, name, districtName, street, city, state, zip, countyName])
  };
}

async function main() {
  console.log("Loading NCES public school district names...");
  const districtNames = await fetchDistrictNames();
  console.log(`Loaded ${districtNames.size.toLocaleString()} districts.`);

  let offset = 0;
  let imported = 0;
  let skipped = 0;

  while (true) {
    const page = await fetchFeaturePage(
      PUBLIC_SCHOOL_LAYER,
      "NCESSCH,LEAID,NAME,STREET,CITY,STATE,ZIP,NMCNTY,LOCALE,LAT,LON,SCHOOLYEAR",
      offset
    );
    if (page.length === 0) break;

    const rows = page
      .slice(0, MAX_RECORDS ? Math.max(MAX_RECORDS - imported, 0) : undefined)
      .map((feature) => rowFromSchoolFeature(feature, districtNames))
      .filter(Boolean);
    skipped += page.length - rows.length;

    for (let index = 0; index < rows.length; index += UPSERT_SIZE) {
      const batch = rows.slice(index, index + UPSERT_SIZE);
      await upsertSchoolDirectoryRows(batch);
      imported += batch.length;
    }

    console.log(`Imported ${imported.toLocaleString()} schools...`);
    if (MAX_RECORDS && imported >= MAX_RECORDS) break;
    if (page.length < PAGE_SIZE) break;
    offset += page.length;
  }

  console.log(`School directory import complete. Imported ${imported.toLocaleString()}, skipped ${skipped.toLocaleString()}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
