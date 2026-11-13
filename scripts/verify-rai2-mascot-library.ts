import assert from "node:assert/strict";

import { isRaiMascotUrl, RAI_MASCOT_LIBRARY } from "../shared/mascot-library.ts";
import { launchVerificationServer, runControlOmb } from "./control-omb.ts";

const fixture = await launchVerificationServer();
try {
  const initialResponse = await fetch(`${fixture.info.url}/api/bots`, { headers: { origin: fixture.info.url } });
  assert.equal(initialResponse.status, 200);
  const initialPayload = await initialResponse.json() as { bots?: Array<{ avatarUrl?: string | null }> };
  const initialMascots = new Set((initialPayload.bots ?? []).map((bot) => bot.avatarUrl).filter(isRaiMascotUrl));
  const available = RAI_MASCOT_LIBRARY.length - initialMascots.size;
  for (let index = 1; index <= available; index += 1) {
    await runControlOmb(["new-bot", "--name", `Mascot fixture ${index}`, "--url", fixture.info.url]);
  }
  const response = await fetch(`${fixture.info.url}/api/bots`, { headers: { origin: fixture.info.url } });
  assert.equal(response.status, 200);
  const payload = await response.json() as { bots?: Array<{ name: string; avatarUrl?: string | null; avatarCrop?: string }> };
  const created = (payload.bots ?? []).filter((bot) => bot.name.startsWith("Mascot fixture "));
  assert.equal(created.length, available);
  assert.equal(created.every((bot) => isRaiMascotUrl(bot.avatarUrl)), true);
  assert.equal(created.every((bot) => bot.avatarCrop === "circle"), true);
  const allMascots = new Set([...initialMascots, ...created.map((bot) => bot.avatarUrl).filter(isRaiMascotUrl)]);
  assert.equal(allMascots.size, RAI_MASCOT_LIBRARY.length);
  await runControlOmb(["new-bot", "--name", "Mascot fixture after exhaustion", "--url", fixture.info.url]);
  const exhaustedResponse = await fetch(`${fixture.info.url}/api/bots`, { headers: { origin: fixture.info.url } });
  const exhaustedPayload = await exhaustedResponse.json() as { bots?: Array<{ name: string; avatarUrl?: string | null }> };
  assert.equal(isRaiMascotUrl(exhaustedPayload.bots?.find((bot) => bot.name === "Mascot fixture after exhaustion")?.avatarUrl), true);
  console.log(`RAI2 mascot fixture passed: ${RAI_MASCOT_LIBRARY.length} unique mascots before reuse`);
} finally {
  await fixture.close();
}
