import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const archive = process.argv[2];
if (!archive || !archive.toLowerCase().endsWith(".tgz") || !existsSync(archive)) {
  throw new Error("Pass an existing .tgz archive");
}

const output = process.argv[3] ?? `${archive}.cdx.json`;
const hashFile = (file) => createHash("sha256").update(readFileSync(file)).digest("hex");
const archiveSha256 = hashFile(archive);
const scratch = mkdtempSync(join(tmpdir(), "rai2-sbom-"));
const extract = spawnSync("tar", ["-xzf", archive, "-C", scratch], { stdio: "inherit" });
if (extract.error) throw extract.error;
if (extract.status !== 0) throw new Error("Could not extract archive for SBOM generation");

const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
  const path = join(dir, entry.name);
  return entry.isDirectory() ? walk(path) : [path];
});
const files = walk(scratch).sort((a, b) => a.localeCompare(b));
const fileComponents = files.map((file) => ({
  type: "file",
  name: relative(scratch, file).replaceAll("\\", "/"),
  hashes: [{ alg: "SHA-256", content: hashFile(file) }],
  properties: [{ name: "rai2:archive-relative-path", value: relative(scratch, file).replaceAll("\\", "/") }],
}));

const rootPath = existsSync(join(scratch, "package")) ? join(scratch, "package") : join(scratch, "saas");
const dependencyReportPath = join(rootPath, "compliance", "dependency-licenses.json");
const dependencyReport = JSON.parse(readFileSync(dependencyReportPath, "utf8"));
const packageComponents = dependencyReport.dependencies.map((dependency) => {
  const version = dependency.versions[dependency.versions.length - 1];
  const scoped = dependency.name.startsWith("@") ? dependency.name.split("/") : ["", dependency.name];
  const group = scoped.length === 2 ? scoped[0].slice(1) : undefined;
  const name = scoped.length === 2 ? scoped[1] : dependency.name;
  const license = dependency.license;
  const licenses = license.includes(" ") || license.includes("(") || license.includes("AND") || license.includes("OR")
    ? [{ expression: license }]
    : [{ license: { id: license } }];
  return {
    type: "library",
    ...(group ? { group } : {}),
    name,
    version,
    purl: `pkg:npm/${dependency.name}@${version}`,
    licenses,
    properties: [{ name: "rai2:provenance", value: "pnpm production dependency graph bundled or used to build this artifact" }],
  };
});

const packageJson = existsSync(join(rootPath, "package.json"))
  ? JSON.parse(readFileSync(join(rootPath, "package.json"), "utf8"))
  : { ...JSON.parse(readFileSync(join(root, "package.json"), "utf8")), name: "@raifirst/rai2-saas" };
const sbom = {
  bomFormat: "CycloneDX",
  specVersion: "1.6",
  serialNumber: `urn:uuid:${archiveSha256.slice(0, 8)}-${archiveSha256.slice(8, 12)}-4${archiveSha256.slice(13, 16)}-8${archiveSha256.slice(17, 20)}-${archiveSha256.slice(20, 32)}`,
  version: 1,
  metadata: {
    timestamp: new Date().toISOString(),
    tools: [{ vendor: "RAI FIRST", name: "generate-rai2-sbom", version: packageJson.version }],
    component: { type: "application", name: packageJson.name, version: packageJson.version },
    properties: [
      { name: "rai2:archive-sha256", value: archiveSha256 },
      { name: "rai2:archive-file-count", value: String(files.length) },
      { name: "rai2:restricted-enterprise-source", value: "absent" },
      { name: "rai2:source-base-commit", value: "f55d45c6e0764ec78e5ba8b0427150656dc94c92" },
    ],
  },
  components: [...packageComponents, ...fileComponents],
};
writeFileSync(output, `${JSON.stringify(sbom, null, 2)}\n`);
console.log(`RAI2 CycloneDX SBOM: ${output}`);
console.log(`Archive SHA-256: ${archiveSha256}`);
