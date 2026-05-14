# Linux Debian Setup Guide

If you are experiencing dependency or Docker errors on Linux Debian, follow these steps to set up the environment and run the project.

## 1. Install Prerequisites

Run the following command to install the necessary system packages:

```bash
sudo apt-get update && sudo apt-get install -y \
    curl \
    python3-venv \
    nodejs \
    npm \
    docker.io \
    docker-compose-v2 \
    build-essential \
    libpq-dev \
    libjpeg-dev \
    zlib1g-dev
```

## 2. Configure Docker Permissions

By default, Docker requires `sudo`. To run it without `sudo`, add your user to the `docker` group:

```bash
sudo usermod -aG docker $USER
```

*Note: You may need to log out and log back in for this to take effect.*

## 3. Run the Project

You can now use the unified `run.sh` script from the root directory. It will automatically detect your OS and handle Docker services.

```bash
./run.sh start
```

### Running Everything in Docker (Recommended)

If you still have issues with local Python/Node dependencies, you can run the entire application stack in Docker:

```bash
docker compose up --build
```

This will build all services (Backend, Frontend, Search, Postgres, Redis) in isolated containers with all dependencies correctly pre-installed.

## 4. Troubleshooting

- **Port Conflicts**: If port 80, 8000, or 5173 is already in use, you can change them in `five_star_a/docker-compose.yml`.
- **Docker Daemon**: If you see "Docker daemon is not running", start it with `sudo systemctl start docker`.
