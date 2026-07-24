# Dependencias — regla del lockfile

Nunca commitees un cambio de dependencias (`package.json`) sin **regenerar y commitear** `package-lock.json` en el mismo commit (`npm install`, luego `git add package-lock.json`).

Evita rangos flotantes (`^`, `~`) en dependencias problemáticas por drift (p. ej. `postcss` está fijado a versión EXACTA): un rango flotante deja que `npm ci` en CI/deploy resuelva a una versión más nueva que la del lock y falle con `lock file's X does not satisfy Y`.

El workflow `.github/workflows/lockfile-check.yml` corre `npm ci --dry-run` en cada push/PR y falla si `package.json` y el lock quedaron desincronizados.
