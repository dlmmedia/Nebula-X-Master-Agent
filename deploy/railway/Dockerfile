# ============================================================================
# Nebula X — Railway Deployment
# Multi-stage build: compile from source, then deploy on Debian slim
# ============================================================================

# ---------------------------------------------------------------------------
# Stage 1: Build the Nebula X binary
# ---------------------------------------------------------------------------
FROM oven/bun:1.3.9-debian AS builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    bash \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /build

# Copy the entire opencode workspace
COPY opencode/ ./

# Install all dependencies
RUN bun install --frozen-lockfile 2>/dev/null || bun install

# Build the binary for current platform (linux-x64, glibc)
ENV OPENCODE_VERSION="1.2.6"
ENV OPENCODE_CHANNEL="latest"
RUN cd packages/opencode && bun run script/build.ts --single --skip-install

# ---------------------------------------------------------------------------
# Stage 2: Production runtime (Debian slim for glibc compatibility)
# ---------------------------------------------------------------------------
FROM debian:bookworm-slim AS runtime

# Install runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    ripgrep \
    git \
    nodejs \
    npm \
    bash \
    curl \
    openssh-client \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Copy the built binary
COPY --from=builder /build/packages/opencode/dist/nebula-x-linux-x64/bin/nebula-x /usr/local/bin/nebula-x
RUN chmod +x /usr/local/bin/nebula-x

# Verify binary works
RUN nebula-x --version

# Point all XDG directories to the persistent volume mount
ENV XDG_DATA_HOME=/data/.local/share
ENV XDG_CONFIG_HOME=/data/.config
ENV XDG_STATE_HOME=/data/.local/state
ENV XDG_CACHE_HOME=/data/.cache

# Default workspace for coding projects (on the volume for persistence)
ENV NEBULA_WORKSPACE=/data/workspace

# Railway injects PORT; default to 4096
ENV PORT=4096

# Copy entrypoint script
COPY deploy/railway/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

WORKDIR /data/workspace

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
