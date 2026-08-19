CREATE TYPE "SchoolDirectorySource" AS ENUM ('NCES_PUBLIC', 'NCES_PRIVATE', 'MANUAL');

CREATE TABLE "SchoolDirectory" (
    "id" TEXT NOT NULL,
    "source" "SchoolDirectorySource" NOT NULL DEFAULT 'NCES_PUBLIC',
    "externalId" TEXT NOT NULL,
    "ncesSchoolId" TEXT,
    "ncesDistrictId" TEXT,
    "name" TEXT NOT NULL,
    "districtName" TEXT,
    "street" TEXT,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "zip" TEXT,
    "countyName" TEXT,
    "locale" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "sourceYear" TEXT NOT NULL,
    "searchText" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SchoolDirectory_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "School" ADD COLUMN "officialDirectoryId" TEXT;

CREATE UNIQUE INDEX "SchoolDirectory_source_externalId_key" ON "SchoolDirectory"("source", "externalId");
CREATE INDEX "SchoolDirectory_state_city_idx" ON "SchoolDirectory"("state", "city");
CREATE INDEX "SchoolDirectory_zip_idx" ON "SchoolDirectory"("zip");
CREATE INDEX "SchoolDirectory_name_idx" ON "SchoolDirectory"("name");
CREATE INDEX "SchoolDirectory_sourceYear_idx" ON "SchoolDirectory"("sourceYear");
CREATE INDEX "School_officialDirectoryId_idx" ON "School"("officialDirectoryId");

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX "SchoolDirectory_searchText_trgm_idx" ON "SchoolDirectory" USING GIN ("searchText" gin_trgm_ops);

ALTER TABLE "School" ADD CONSTRAINT "School_officialDirectoryId_fkey"
FOREIGN KEY ("officialDirectoryId") REFERENCES "SchoolDirectory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
