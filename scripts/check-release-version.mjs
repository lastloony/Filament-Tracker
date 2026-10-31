// Refuse publication when the tag and application manifests disagree.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolve, dirname } from 'node:path'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const read = (path) => readFileSync(resolve(root, path), 'utf8')
const tag = process.env.RELEASE_TAG
if (!/^v\d+\.\d+\.\d+$/.test(tag ?? '')) {
  throw new Error('Release tag must use vMAJOR.MINOR.PATCH, for example v0.3.7')
}
const expected = tag.slice(1)
const tomlVersion = (path, section) => {
  const content = read(path).split(`[${section}]`)[1]?.split(/^\[/m)[0]
  return content?.match(/^version\s*=\s*"([^"]+)"/m)?.[1]
}
const versions = {
  'backend/pyproject.toml': tomlVersion('backend/pyproject.toml', 'project'),
  'desktop/src-tauri/Cargo.toml': tomlVersion('desktop/src-tauri/Cargo.toml', 'package'),
}
for (const path of ['frontend/package.json', 'desktop/package.json', 'desktop/src-tauri/tauri.conf.json']) {
  versions[path] = JSON.parse(read(path)).version
}
for (const [path, version] of Object.entries(versions)) {
  if (version !== expected) {
    throw new Error(`${path}: version ${version} does not match tag ${tag}`)
  }
}
console.log(`Release ${tag}: all application versions match`)
