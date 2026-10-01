# Image of the `build` service of docker-compose.yml, which generates build/web: Node and pnpm compile the interface
# (web/) and uv runs the Python scripts (with uv's own Python, so it does not depend on the image's). Git reads the
# history of the data for «Novedades» (scripts/history.py); without it the web is built without them.
# The pnpm version has to be the one in the packageManager field of web/package.json.
FROM ghcr.io/astral-sh/uv:latest AS uv

FROM node:22-bookworm-slim
ARG PNPM_VERSION=10.32.1
COPY --from=uv /uv /uvx /usr/local/bin/
ENV UV_PYTHON_INSTALL_DIR=/opt/python \
    UV_PYTHON_PREFERENCE=only-managed
RUN apt-get update && apt-get install --yes --no-install-recommends git && rm -rf /var/lib/apt/lists/* \
    && npm install --global pnpm@${PNPM_VERSION} \
    && uv python install 3.13 \
    && chmod -R a+rX /opt/python
