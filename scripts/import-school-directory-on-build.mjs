if (process.env.SCHOOL_DIRECTORY_IMPORT_ON_BUILD !== "true") {
  console.log("School directory import skipped.");
  process.exit(0);
}

await import("./import-school-directory.mjs");
