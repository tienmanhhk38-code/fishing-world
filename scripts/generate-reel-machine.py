"""Dry mechanical spinning-reel clicks. No hum, sustained tone, or noise bed."""
from pathlib import Path
import math, random, struct, wave

rate, seconds = 44100, 1
rng = random.Random(73403)
samples = [0.0] * rate
# Discrete pawl contacts, with small timing/strength variations to avoid the
# pitched buzz of a perfectly periodic motor. Silence between every contact.
for tooth in range(22):
    start = int((tooth / 22 + rng.uniform(.002, .006)) * rate)
    strength = rng.uniform(.65, 1)
    previous = 0.0
    for j in range(int(.004 * rate)):
        age = j / rate
        noise = rng.uniform(-1, 1)
        highpass = (noise - previous) * .5
        previous = noise
        attack = min(1, j / 3)
        envelope = math.exp(-age * 1500) * attack
        # A short second contact is the pawl settling against the tooth.
        settle = math.exp(-(age - .0014) * 2400) * .3 if age >= .0014 else 0
        index = start + j
        if index < len(samples):
            samples[index] += strength * highpass * (envelope + settle)
peak = max(abs(s) for s in samples)
samples = [s * .55 / peak for s in samples]
out = Path(__file__).resolve().parents[1] / 'apps/client/public/assets/audio/reel-machine-v3.wav'
with wave.open(str(out), 'wb') as audio:
    audio.setparams((1, 2, rate, 0, 'NONE', 'not compressed'))
    audio.writeframes(b''.join(struct.pack('<h', round(s * 32767)) for s in samples))
print(f'Generated {out.name}: {seconds}s, dry clicks only, {sum(s == 0 for s in samples)/len(samples):.1%} silence')
