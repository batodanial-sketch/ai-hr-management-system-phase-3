# Backup and Recovery Runbook

## Required evidence before certification

- Managed database backup frequency and retention from the actual provider console/API.
- Point-in-time recovery availability and retention.
- Storage object retention/versioning policy for private HR documents.
- A controlled restore into a non-production project.
- Measured restore duration and data-loss window.
- Verification of migrations, foreign keys, indexes, functions, RLS policies, Auth configuration, and Storage bucket privacy after restore.

## Operational process

Backups must be encrypted, access-controlled, monitored, and tested. Never treat a migration file, database export command, or local seed as a backup. Do not restore over production until the isolated restore passes the security and tenant-isolation suite.

## Current verdict

`BLOCKED-EXTERNAL`: no production database project, managed backup settings, or restore target is available in this environment.
