"""Original procedural sound assets; Python standard library only."""
from pathlib import Path
import math, random, struct, wave

OUT = Path(__file__).resolve().parents[1] / 'apps/client/public/assets/audio'
OUT.mkdir(parents=True, exist_ok=True)
RATE = 22050

def save(name, seconds, sample):
    with wave.open(str(OUT / (name + '.wav')), 'wb') as file:
        file.setparams((1, 2, RATE, 0, 'NONE', 'not compressed'))
        file.writeframes(b''.join(struct.pack('<h', int(max(-1, min(1, sample(i / RATE))) * 26000)) for i in range(int(seconds * RATE))))

rng = random.Random(20261110)
low = 0
def ocean(t):
    global low
    noise = rng.uniform(-1, 1)
    low = low * .96 + noise * .04
    swell = .4 + .3 * math.sin(2 * math.pi * t / 6) ** 2
    # Fade the loop boundary and avoid abrupt changes in the noise floor.
    edge = min(1, t * 3, (12 - t) * 3)
    gull = 0
    for start in [2.5, 8.2]:
        a = t - start
        if 0 < a < .45:
            gull += .035 * math.sin(2 * math.pi * (1000 * a + 350 * a * a)) * math.sin(math.pi * a / .45) ** 2
    return (low * 1.4 + noise * .045) * swell * edge + gull
save('tropical-shore', 12, ocean)

notes = [76, 79, 81, 79, 74, 72, 74, 76, 79, 81, 84, 81, 79, 76, 74, 72,
         76, 79, 81, 84, 81, 79, 76, 74, 72, 74, 76, 79, 76, 74, 72, 0]
def music(t):
    value = 0
    for i, note in enumerate(notes):
        age = t - i * .5
        if note and 0 < age < 1.5:
            hz = 440 * 2 ** ((note - 69) / 12)
            value += .15 * math.exp(-age * 5) * min(1, age * 200) * (math.sin(2 * math.pi * hz * age) + .2 * math.sin(2 * math.pi * hz * 2 * age))
    return value * min(1, (16 - t) * 2)
save('island-melody', 16, music)

def tone(freq, t, length):
    return math.sin(2 * math.pi * freq * t) * math.sin(math.pi * t / length) ** 2 if 0 < t < length else 0
save('bite', .5, lambda t: .26 * (tone(880, t, .19) + tone(1174.66, t - .22, .22)) + .22 * math.sin(2 * math.pi * 110 * t) * (.5 + .5 * math.sin(2 * math.pi * 34 * t)) * math.sin(math.pi * t / .5) ** 2)
save('cast', .6, lambda t: rng.uniform(-1, 1) * .13 * math.sin(math.pi * t / .6) ** 4 + .25 * tone(180, t - .35, .18))
save('hook', .35, lambda t: .28 * math.sin(2 * math.pi * (300 * t + 800 * t * t)) * math.exp(-8 * t))
save('catch', 1.1, lambda t: sum(.22 * tone(f, t - start, .35) for f, start in [(523.25, 0), (659.25, .18), (783.99, .36), (1046.5, .57)]))
save('click', .08, lambda t: .12 * tone(650, t, .08))
save('miss', .4, lambda t: .15 * math.sin(2 * math.pi * (320 * t - 220 * t * t)) * math.sin(math.pi * t / .4) ** 2)
save('nibble', .16, lambda t: .12 * tone(480, t, .16))
save('reel', .8, lambda t: .08 * math.sin(2 * math.pi * 145 * t) * (.6 + .4 * math.sin(2 * math.pi * 35 * t)) + .015 * rng.uniform(-1, 1))
save('line-break', .5, lambda t: .48 * rng.uniform(-1, 1) * math.exp(-55 * t) + .24 * math.sin(2 * math.pi * (640 * t - 500 * t * t)) * math.exp(-10 * t))
print('Generated 11 original WAV assets.')
