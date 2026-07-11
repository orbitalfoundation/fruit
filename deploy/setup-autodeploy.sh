#!/usr/bin/env bash
# One-time installer for on-VM continuous deployment. Run from the repo root:
#   deploy/setup-autodeploy.sh [vm-name]      (default: fruit)
#
# After this, the VM polls GitHub main every ~2 minutes and, when the SHA moves,
# pulls + rebuilds + syncs into /srv/site. Pushing to main IS the deploy;
# deploy/deploy.sh remains a manual override.
set -euo pipefail

VM="${1:-${VM:-fruit}}"
HOST="$VM.exe.xyz"
DEST="exedev@$HOST"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SSH_OPTS=(-o StrictHostKeyChecking=accept-new -o UserKnownHostsFile=/dev/null -o LogLevel=ERROR -o ServerAliveInterval=5 -o ServerAliveCountMax=3)
SSH() { ssh "${SSH_OPTS[@]}" "$DEST" "$@"; }

echo "› installing Node 22 + git + rsync on $HOST"
SSH 'node -e "process.exit(+process.versions.node.split(\".\")[0] >= 20 ? 0 : 1)" 2>/dev/null || {
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - &&
  sudo apt-get install -y nodejs; }'
SSH 'sudo apt-get install -y -q git rsync'

echo "› creating /srv/autodeploy and uploading the deployer"
SSH 'sudo mkdir -p /srv/autodeploy && sudo chown exedev:exedev /srv/autodeploy'
rsync -e "ssh ${SSH_OPTS[*]}" -avh "$ROOT/deploy/autodeploy.sh" "$DEST:/srv/autodeploy/autodeploy.sh"
SSH 'chmod +x /srv/autodeploy/autodeploy.sh'

echo "› installing systemd service + timer"
SSH 'sudo tee /etc/systemd/system/fruit-autodeploy.service >/dev/null' <<'UNIT'
[Unit]
Description=Fruit — rebuild + redeploy when GitHub main changes
After=network-online.target

[Service]
Type=oneshot
User=exedev
ExecStart=/srv/autodeploy/autodeploy.sh
UNIT

# OnUnitInactiveSec re-arms only after the previous run finishes, so a slow build
# can never overlap the next poll.
SSH 'sudo tee /etc/systemd/system/fruit-autodeploy.timer >/dev/null' <<'UNIT'
[Unit]
Description=Poll GitHub main for Fruit deploys

[Timer]
OnBootSec=1min
OnUnitInactiveSec=2min

[Install]
WantedBy=timers.target
UNIT

SSH 'sudo systemctl daemon-reload && sudo systemctl enable --now fruit-autodeploy.timer'

echo "› first run (deploys current main now)"
SSH 'sudo systemctl start fruit-autodeploy.service'
SSH 'systemctl status fruit-autodeploy.timer --no-pager -l | head -6'

echo "✓ auto-deploy installed. Watch it with:"
echo "    ssh $DEST journalctl -u fruit-autodeploy -f"
