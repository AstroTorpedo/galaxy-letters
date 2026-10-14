import { packager } from '@electron/packager';
import { cp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const release = path.join(root, 'release');
const staging = path.join(release, 'staging');
const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const electronVersion = '44.7.2';
await readFile(path.join(root, 'dist/index.html'));
await mkdir(release, { recursive: true });
await rm(staging, { recursive: true, force: true });
await mkdir(path.join(staging, 'electron'), { recursive: true });
await cp(path.join(root, 'dist'), path.join(staging, 'dist'), { recursive: true });
await cp(path.join(root, 'electron/main.cjs'), path.join(staging, 'electron/main.cjs'));
await writeFile(path.join(staging, 'package.json'), JSON.stringify({ name: pkg.name, version: pkg.version, productName: 'GalaxyLetters', description: pkg.description, main: 'electron/main.cjs', author: 'Galaxy Letters', license: 'UNLICENSED' }, null, 2));
await cp(path.join(root, 'docs/DISTRIBUTION_README.txt'), path.join(staging, 'READ-ME.txt'));
await cp(path.join(root, 'node_modules/phaser/LICENSE.md'), path.join(staging, 'PHASER-LICENSE.md'));
const requested = process.argv.slice(2);
const targets = requested.includes('--win') ? [['win32', 'x64']] : requested.includes('--mac') ? [['darwin', 'arm64']] : [['darwin', 'arm64'], ['win32', 'x64']];
for (const [platform, arch] of targets) {
  console.log(`Packaging ${platform}/${arch} with Electron ${electronVersion} ...`);
  const outputs = await packager({
    dir: staging, out: path.join(release, 'platforms'), name: 'GalaxyLetters',
    platform, arch, electronVersion, appVersion: pkg.version,
    appBundleId: 'org.galaxyletters.observatory', asar: true, prune: true, overwrite: true,
    ...(platform === 'darwin' ? { extendInfo: { CFBundleDisplayName: '21厘米：星系来信' }, osxSign: { identity: '-' } } : {}),
  });
  const filename = `GalaxyLetters-${pkg.version}-${platform === 'darwin' ? 'macOS-AppleSilicon' : 'Windows-x64'}.zip`;
  const archive = path.join(release, filename);
  await rm(archive, { force: true });
  if (platform === 'darwin') execFileSync('ditto', ['-c', '-k', '--sequesterRsrc', '--keepParent', path.join(outputs[0], 'GalaxyLetters.app'), archive], { stdio: 'inherit' });
  else execFileSync('zip', ['-q', '-r', archive, path.basename(outputs[0])], { cwd: path.dirname(outputs[0]), stdio: 'inherit' });
  console.log(`Created ${archive}`);
}
