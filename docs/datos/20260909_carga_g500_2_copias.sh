#!/bin/sh
# Extrae del pg_dump del esquema `expo` solo los bloques COPY, y los reapunta al
# esquema de estacionamiento `carga_g500`.
#
# Dos filtros, y los dos importan:
#  · el sed de renombrado toca UNICAMENTE lineas que empiezan por COPY, para que
#    un dato que contenga "expo." no se corrompa;
#  · se quitan las meta-ordenes \restrict y \unrestrict que pg_dump moderno pone
#    alrededor del volcado. Al cortar desde el primer COPY nos quedabamos con el
#    cierre sin su apertura, y psql aborta con "not currently in restricted mode".
set -e
pg_dump -U spaces -d spaces_puente --data-only --schema=expo --exclude-table=expo._origen > /tmp/datos.sql
sed -n '/^COPY /,$p' /tmp/datos.sql \
  | sed 's/^COPY expo\./COPY carga_g500./' \
  | grep -v '^\\unrestrict' \
  | grep -v '^\\restrict' > /tmp/copias.sql
echo "lineas: $(wc -l < /tmp/copias.sql)"
echo "bloques COPY: $(grep -c '^COPY carga_g500' /tmp/copias.sql)"
echo "terminadores: $(grep -c '^\\\\\.$' /tmp/copias.sql)"
echo "meta-ordenes restantes: $(grep -c '^\\\\[a-z]' /tmp/copias.sql || true)"
