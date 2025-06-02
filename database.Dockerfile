FROM postgres:17.5

COPY init-user-db.sh /docker-entrypoint-initdb.d/
RUN chmod +x /docker-entrypoint-initdb.d/init-user-db.sh

ENV POSTGRES_USER=postgres
ENV POSTGRES_DB=postgres
