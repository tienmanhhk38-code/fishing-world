# Harbor art pass v2

Project-authored geometry, vertex paint, wood-grain texture, six-joint character rigs, blink morph and seven animation clips. These are new GLB assets; the original starter assets remain in ../starter/.

The thirteen assets are four fisher presets plus dock, dock_post, palm, house, bush, rocks, crate, lighthouse and island. The island retains the shared village walking plateau while rounding its sandy shoreline.

Editable source: apps/client/src/art/harbor-author.ts. The models are authored parametrically in Three.js and exported as glTF 2.0, not hand-sculpted Blender files. No third-party model/texture downloads are included.

With the development server running, execute `node scripts/build-harbor-assets.mjs` to rebuild GLBs and manifest. Execute `node scripts/render-asset-thumbnails.mjs` to regenerate matching UI images. Use `node scripts/capture-harbor-preview.mjs` for in-game visual QA.

The four character variants contain Idle, Walk, Cast, Wait, Hook, Reel and Celebrate clips. Idle includes a Blink morph channel. Runtime instantiates independent skeletons and animation mixers; static scenery is batched/instanced. Quality High caches a directional shadow map for the static world; moving characters retain contact shadows. Quality Low disables that shadow map.

The starter fish, rods, market stall, benches and some decorative pieces are still reused. This is the first representative harbor art pass, not a claim that every island prop has been rebuilt or that mobile performance is certified.
