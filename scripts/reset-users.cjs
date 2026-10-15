// Historical bulk reset intentionally disabled: never reset users during deployment.
console.error("Bulk account reset is disabled. Use reviewed, scoped account-management operations.");
process.exitCode = 1;
