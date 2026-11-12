#!/usr/bin/env bash
set -euo pipefail

stage=/root/rai2-sso-stage
archive=rai2-runtime-0.1.151-e408b7d8a0ce0cd5.tgz
target=/opt/rai2/releases/runtime-e408b7d8a0ce0cd5
current=/opt/rai2/node/lib/node_modules/@raifirst/rai2-runtime
previous=$(readlink -f "$current")
activated=0

rollback() {
  status=$?
  if (( status != 0 && activated == 1 )); then
    npm --prefix /opt/rai2/node/lib/node_modules install -g --ignore-scripts "$previous" >/dev/null 2>&1 || true
    systemctl restart openmausbot-fleet || true
    for unit in $(systemctl list-units --all --plain --no-legend 'openmausbot@*.service' | awk '{print $1}'); do systemctl restart "$unit" || true; done
    printf 'Runtime handoff release rolled back\n' >&2
  fi
  exit "$status"
}
trap rollback EXIT

cd "$stage"
sha256sum -c "${archive}.sha256"
test ! -e "$target"
install -d -m 755 "$target"
tar -xzf "$archive" -C "$target" --strip-components=1
chown -R root:root "$target"
npm --prefix /opt/rai2/node/lib/node_modules install -g --ignore-scripts "$target"
activated=1
systemctl restart openmausbot-fleet
for unit in $(systemctl list-units --all --plain --no-legend 'openmausbot@*.service' | awk '{print $1}'); do systemctl restart "$unit"; done
for attempt in {1..20}; do
  count=$(jq '[.workspaces[] | select(.status == "running")] | length' /etc/openmausbot/fleet.json)
  [[ $count -ge 1 ]] && break
  sleep 1
done
[[ $count -ge 1 ]]
printf 'Runtime handoff release active: %s\n' "$(readlink -f "$current")"
