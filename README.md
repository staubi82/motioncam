# MotionCam

Self-hosted surveillance web app for Raspberry Pi 4 (DietPi), accessible via Tailscale.

## Requirements

- Node.js 20 LTS
- FFmpeg + FFprobe
- `motion` daemon

```bash
sudo apt install ffmpeg motion nodejs npm
```

## Setup

```bash
# Clone repo (as root on DietPi)
git clone <repo-url> /root/motioncam
cd /root/motioncam

mkdir -p data public/uploads public/thumbnails

cp .env.example .env
# Edit .env with your settings

npm install --omit=dev

# Create first admin user
node scripts/create-admin.js

# Start
npm start
```

## Deployment (systemd)

```bash
sudo cp scripts/motioncam.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable motioncam
sudo systemctl start motioncam
```

## motion daemon config

```bash
sudo cp config/motion.conf.example /etc/motion/motion.conf
# Edit: replace YOUR_HOOK_SECRET with value from .env
sudo systemctl enable motion
sudo systemctl start motion
```

## Adding more users

```bash
node scripts/create-admin.js
```
