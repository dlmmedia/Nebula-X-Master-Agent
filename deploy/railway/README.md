# Nebula X — Railway Deployment

Deploy Nebula X as a cloud-based AI coding agent on [Railway](https://railway.app). This gives you a browser-accessible development environment powered by Gemini orchestration, with persistent storage for your projects and sessions.

## Architecture

```
Browser ──► Railway Service (Nebula X) ──► AI Providers (Gemini, OpenAI, Anthropic, etc.)
                    │
                    ├── API Server (Hono)
                    ├── Web UI (proxied from app.opencode.ai)
                    ├── Bash/Shell execution
                    ├── File read/write/edit
                    ├── Git operations
                    └── SQLite database
                    │
              /data (Persistent Volume)
                    ├── .local/share/opencode/opencode.db  (sessions, history)
                    ├── .config/opencode/                   (configuration)
                    └── workspace/                          (your code projects)
```

## Quick Start

### 1. Create a Railway Project

1. Go to [railway.app](https://railway.app) and create a new project
2. Select **"Deploy from GitHub Repo"**
3. Connect this repository (`dlmmedia/Nebula-X-Master-Agent`)
4. Set the branch to `deploy/railway`

### 2. Configure the Service

Railway will auto-detect the `railway.toml` configuration. Verify these settings in the Railway dashboard:

- **Dockerfile Path**: `deploy/railway/Dockerfile`
- **Root Directory**: `.` (project root)

### 3. Add a Persistent Volume

1. In your Railway service, click **"+ New"** → **"Volume"**
2. Set the **mount path** to `/data`
3. Choose your size (5 GB is a good start for Hobby plan)

### 4. Set Environment Variables

In the Railway dashboard, add these environment variables:

#### Required

| Variable | Description |
|----------|-------------|
| `OPENCODE_SERVER_PASSWORD` | Password to secure the web interface (basic auth) |

#### AI Provider Keys (at least one required)

| Variable | Description |
|----------|-------------|
| `GEMINI_API_KEY` | Google Gemini API key |
| `ANTHROPIC_API_KEY` | Anthropic Claude API key |
| `OPENAI_API_KEY` | OpenAI API key |
| `OPENROUTER_API_KEY` | OpenRouter API key (access to 75+ models) |

#### Optional

| Variable | Default | Description |
|----------|---------|-------------|
| `OPENCODE_SERVER_USERNAME` | `opencode` | Username for basic auth |
| `PORT` | `4096` | Server port (Railway auto-injects this) |
| `NEBULA_WORKSPACE` | `/data/workspace` | Default workspace directory |

### 5. Deploy

Railway will automatically build and deploy. The first build takes a few minutes (compiling from source). Subsequent deploys are faster with build caching.

### 6. Access

Once deployed, Railway provides a public URL like `https://nebula-x-production-xxxx.up.railway.app`. Open it in your browser, enter your credentials, and start coding.

## Usage

### Working with Projects

Once connected, you can:

1. **Clone a repo** — Use the terminal or ask the AI agent to clone a repo into your workspace
2. **Edit files** — The AI agent can read, write, and edit files on the Railway container
3. **Run commands** — Execute `npm install`, `git commit`, build commands, etc.
4. **Switch projects** — Use the directory header to navigate between projects

### Persistence

Everything under `/data` survives redeploys:
- **Database** — Session history, conversation threads, permissions
- **Config** — Your `opencode.json` settings, provider credentials
- **Projects** — Any repos cloned into `/data/workspace`

Anything outside `/data` is ephemeral (reset on each deploy).

## Troubleshooting

### Build Fails

- Ensure the branch is set to `deploy/railway`
- Check that the Dockerfile path is `deploy/railway/Dockerfile`
- The build context must be the project root (not `deploy/railway/`)

### Cannot Connect

- Verify `OPENCODE_SERVER_PASSWORD` is set
- Check the Railway logs for startup errors
- Ensure the health check passes (endpoint: `/doc`)

### Data Lost After Redeploy

- Confirm a volume is mounted at `/data`
- Check that files are being written to `/data/workspace` not `/workspace`

### AI Provider Errors

- Verify your API keys are set in Railway environment variables
- Check Railway logs for authentication errors from providers

## Updating

To update Nebula X:

1. Pull the latest changes from the `deploy/railway` branch
2. Railway will automatically redeploy
3. The volume preserves all your data across updates

## Limitations

- **Single user** — One user at a time (single SQLite database)
- **Container tools** — Only tools installed in the Docker image are available for bash commands (git, node, npm, ripgrep are included)
- **Brief downtime on redeploy** — Railway doesn't support zero-downtime with volumes
- **Cloud filesystem** — You're coding on Railway's infrastructure, not your local machine

## License

MIT — DLM Media
