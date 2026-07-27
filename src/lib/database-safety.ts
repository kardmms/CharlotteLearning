import "server-only";

export function assertDatabaseEnvironmentSafety() {
  const deploymentEnvironment =
    process.env.VERCEL_ENV ||
    process.env.DEPLOYMENT_ENV ||
    "";
  const databaseEnvironment = process.env.DATABASE_ENVIRONMENT || "";

  if (deploymentEnvironment === "production" && databaseEnvironment !== "production") {
    throw new Error(
      "Production database safety check failed: set DATABASE_ENVIRONMENT=production only on the production database."
    );
  }

  if (
    (deploymentEnvironment === "preview" || deploymentEnvironment === "development") &&
    databaseEnvironment === "production"
  ) {
    throw new Error(
      "Database safety check failed: preview and development deployments cannot use a production-labeled database."
    );
  }
}
