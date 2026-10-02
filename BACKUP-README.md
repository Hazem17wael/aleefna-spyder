# Safe backup and restore for this Docker project

## What I inspected before choosing the backup method

The real runtime layout is:

- `Pet-landing` = Next.js frontend
- `pet-society` = Laravel API/backend
- `pet-society-mobile` = Expo/React Native app

The backend database is MySQL and is defined in `docker-compose.yml` as:

- service: `mysql`
- container name: `pet-society-db`
- database: `aleefna`
- user: `aleefna`
- password: `aleefna`
- volume: `pet_society_db`

The important persistent data is not only the database. The Laravel app stores uploaded pet images under:

- `pet-society/public/pets/`

These are real user-uploaded files, not just source assets. I verified the actual files exist there before backing them up.

I also checked the mobile app assets under `pet-society-mobile/assets/images/`; those are static source files used by the app build, not runtime database content or uploaded user media.

## Actual migration backup created

These backup artifacts were created in this workspace:

- `backups/aleefna-db-backup.sql` — MySQL dump of the `aleefna` database
- `backups/uploads/pets/` — copied pet upload images from `pet-society/public/pets/`
- `backups/uploads/storage-app-private/` — copied private Laravel storage files that are outside the database

## Important issue found during backup

The current machine already has a MySQL service listening on host port `3306`, so the project's Compose stack cannot start cleanly without a port conflict. To avoid altering the host database setup, the dump was created using a temporary MySQL container bound to port `3307` instead.

On the new laptop, either:

1. stop any local MySQL service already bound to `3306`, or
2. change the compose port mapping from `3306:3306` to `3307:3306` (and update the API `DB_PORT` to `3307` if needed).

## Restore steps on the target laptop

1. Copy the whole project folder to the new laptop.
2. Open the project root and ensure Docker is running.
3. Start the database first:

```bash
cd /path/to/Pet
docker compose up -d mysql
```

If port `3306` is occupied on the target machine, switch the Compose port mapping to a free port such as `3307` before starting the stack.

4. Restore the database:

```bash
docker exec -i pet-society-db mysql -uroot -proot aleefna < backups/aleefna-db-backup.sql
```

If the database container was recreated with a different root password, replace `-proot` with the correct one.

5. Restore uploaded files:

```bash
mkdir -p pet-society/public/pets
cp -a backups/uploads/pets/. pet-society/public/pets/
cp -a backups/uploads/storage-app-private/. pet-society/storage/app/private/
```

6. Start the full app stack:

```bash
docker compose up -d
```

## Notes

- The database is the source of truth for app records.
- The uploaded pet images in `pet-society/public/pets/` are also important runtime data and should be restored with the DB.
- The `pet-society-mobile` app has no database to restore; its `assets/images` are build-time static assets, not user data.
- The generated backup files are copies only. The original source files in the current machine were not deleted, moved, or modified.
