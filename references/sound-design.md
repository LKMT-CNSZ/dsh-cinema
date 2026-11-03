# Sound design

A documentary mix is mostly air and distance, with a few objects close enough to touch the lens. This film has no music. Every sound is an object in the same metric world as the picture, on the same clock, and the mix is judged by measurement because nobody can hear their own score while writing it.

Source of truth: `audio/score.mjs` synthesises `audio/score.wav` from oscillators, noise and one small room, and writes `audio/cues.json`. `scripts/check-audio.mjs` measures the result; `node render.mjs --qa` runs it and merges the audio issues into the same P0/P1/P2 report as the frames. A cue is `{name, t}` in film seconds, plus optional `masked` or `fade` flags that tell the measurement to skip it.

| spec | value |
|---|---|
| format | 44100 Hz, 16-bit stereo WAV, `audio/score.wav`, `DUR = 12.0` (must equal `PROJECT.duration` within 0.15 s) |
| generators | 1 tone bed, 2 noise beds, 6 footsteps × 3 layers, 2 cloth, 5 key sounds, 1 note + 1 sympathetic ring, 7 wingbeats × 2 layers, 4 chirps |
| room | 6 combs + 3 allpasses, stereo spread 19 samples, return ×3.4 |
| master | `tanh(1.15x)/1.15`, peak normalised to 0.82 (−1.72 dBFS), 30 ms fade in, 0.5 s fade out from 11.65 s; delivered at `loudnorm=I=-19:TP=-1.5:LRA=9`, AAC 192k |

## 1 · The bed: wind over a field

Three layers over the full 12 s, all sharing the same two envelopes — the gust and the duck.

| layer | generator | filter | level | pan | send |
|---|---|---|---|---|---|
| body | 42 Hz sine, phase wobble `sin(0.7t)·0.6` rad | — | 0.10 | 0 | 0 |
| air | noise, state-variable band-pass | `fc = 220 + 260·gust(t)`, q 0.9 | 0.16 | 0.05 | 0.25 |
| hiss | noise, high-pass | `fc = 5200`, q 0.7 | 0.09 | −0.20 | 0.20 |

`gust(t) = 0.55 + 0.45·(0.5+0.5·sin(0.9t + 1.7·sin(0.37t)))·(0.7+0.3·sin(2.3t))` — a product of three incommensurate sines, range 0.55–1.00 (5.2 dB), so the air swells without sounding like a synth pad's LFO. Every layer is multiplied by `gust(t) · duckAround(t) · (1 − smooth(11.3, 11.95, t))`: one bed, three spectra, one end.

## 2 · Footsteps on dry grass, and cloth

Five steps at 0.16, 0.62, 1.07, 1.52, 1.96 s (gaps 0.46, 0.45, 0.45, 0.44 s). Each is the two sounds the design names — a **thud** and a **rasp** — plus a short low body noise that gives the thud its weight.

| layer | what it is | level | pan | send |
|---|---|---|---|---|
| thud | sine sweep 72 → 60 Hz over 0.2 s, `exp(−22t)` | 0.32 | −0.25 | 0.18 |
| rasp | noise 2.6 kHz high-passed, starts +5 ms, 0.16 s, `exp(−26t)` | 0.16 | −0.30 | 0.20 |
| body | noise 900 Hz, starts +20 ms, 0.22 s, `exp(−12t)` | 0.12 | −0.20 | 0.25 |

Per-step weight `v = 0.5 + 0.5·sin(2.1i)` gives 0.50, 0.93, 0.06, 0.51, 0.93 — the third step is almost silent, which reads as a soft landing and as a missing step if you only count cues. The gait underneath is a 1.0342 m cycle over a 2.20 s eased walk (mean 1.41 m/s, ≈0.37 s per footfall mid-walk), so a fixed 0.45 s foley cadence does not line up one-to-one with six footfalls: if the drift reads, retime the `steps` array, never add layers.

Cloth is two events of high-passed noise with a half-sine envelope and a 0.6–1.0 random amplitude: 3.30 s (0.55 s, `fc 3400`, level 0.10, pan 0.30) as the arm reaches, 4.85 s (0.70 s, `fc 2900`, level 0.09, pan 0.25) as it withdraws. Quiet on purpose — the sound of a person moving, not of a costume.

## 3 · The key press: three sounds in order

A key press is the finger's touch, the key hitting the bed, then the note, and splitting them is what makes the action feel physical. Touch at 4.200 s (noise 4.2 kHz high-passed, `exp(−90t)`, 50 ms, level 0.12), wooden knock at 4.222 s (sine sweep 168 → 150 Hz, `exp(−34t)`, 180 ms, level 0.30), the note at 4.235 s; a mechanism tick at 4.240 s (noise 1.2 kHz, `exp(−40t)`, 120 ms, level 0.12), and the key returning at 4.625 s (sine sweep 240 → 220 Hz, `exp(−46t)`, level 0.24).

The key travels 6 mm (`womanKeyDepth`: `smoothstep(4.22, 4.27)` down, released by 4.70). The key return is marked `"masked": true` in `audio/cues.json`, so the cue-ratio test is told not to require it to rise above the ringing note.

## 4 · One note that outlives its cause

`NOTE_T = 4.235`, `F0 = mtof(54) = 184.997 Hz` (F#3), `noteLen = 7.4 s`, level 0.95, pan 0.06, room send 0.55. Eleven partials, each with its own weight and decay; partial `h` is at `F0·h·(1 + 0.00022·h²)` and decays with `τ = noteLen·0.34/d = 3.8 / (1 + 0.35·(h−1))` seconds:

| h | weight | d | τ (s) | f (Hz) |
|---|---|---|---|---|
| 1 | 1.00 | 3.20 | 0.79 | 185 |
| 2 | 0.52 | 2.40 | 1.05 | 370 |
| 3 | 0.32 | 1.90 | 1.32 | 556 |
| 4 | 0.20 | 1.50 | 1.68 | 743 |
| 5 | 0.13 | 1.20 | 2.10 | 930 |
| 6 | 0.09 | 1.00 | 2.52 | 1119 |
| 7 | 0.06 | 0.85 | 2.96 | 1309 |
| 8 | 0.045 | 0.72 | 3.49 | 1501 |
| 9 | 0.03 | 0.60 | 4.19 | 1695 |
| 11 | 0.02 | 0.50 | 5.03 | 2089 |
| 13 | 0.014 | 0.42 | 5.99 | 2494 |

The inharmonicity is small but real: the 13th partial is stretched from 2405 Hz to 2494 Hz, 63 cents sharp. The strike is not a click: amplitude swells over 8 ms (`min(1, t/0.008)`), and a hammer of 2100 Hz tone plus noise, decaying at 220/s, rides on top for about 20 ms. A second, softer ring an octave up (0.012, `exp(−0.9t)`, 5.2 s, send 0.70) is the soundboard and the room, not a second note.

Read the table as a spectrum over time: at the strike the fundamental and second dominate; by 4 s the fundamental is the weakest partial and the 4th–6th are strongest; by 11 s what remains is a thin plateau around 750–1500 Hz with its peak near 1.1 kHz. The score's comment says "the high ones die first", but `τ = 3.8 / (1 + 0.35·(h−1))` gives the fundamental the shortest constant and the 13th the longest — the opposite. Either decision is defensible; the `noteTail` measurement is what proves which one you actually built.

The note runs 4.235 → 11.635 s. The picture starts its 0.45 s fade to black at 11.55 s, so the note is still sounding 85 ms into a frame that is already going dark, and it stops 15 ms before the score's own fade begins at 11.65 s: the sound outlives the picture's interest, and the picture starts to go before the sound does. The score calls the useful part "4.2 s of tail": the stretch after the press in which the film stops asking about the note and the note keeps answering.

## 5 · The silence before the note

Silence is written, not left over. `duckAround(t)` multiplies every wind layer by `1 − 0.72·smooth(3.85, 4.15, t)·(1 − smooth(4.75, 5.35, t))`: the air ramps down from 3.85 s, sits at 28 % of level (−11.1 dB) from 4.15 to 4.75 s, and is back by 5.35 s while the note is still ringing.

Nothing else is muted. A muted bed sounds like a fader; a reduced bed sounds like air holding its breath. The pre-note RMS window (4.00–4.20 s) exists to prove the duck happened.

## 6 · Wingbeats and a distant bird

The bird leaves at 9.18 s: seven strokes at `9.18 + 0.185i − 0.006i`, each a low-passed "fwump" plus a small high-passed click. Pan goes +0.35 → +0.19 → +0.03 → −0.13 → −0.28 → −0.44 → −0.60, level 0.19 → 0.105 (−5.2 dB), low-pass centre 280 → 400 Hz, send 0.30 over 1.07 s: distance is carried by level and pan across 0.95 of the stereo field. The filter opens slightly as it leaves; if the departure reads too close, take the cutoff down rather than the level. The audition cue "wingbeat 3" sits at 9.55 while the stroke fires at 9.538.

Four chirps answer from far left: 1.05 s (MIDI 96) and 1.24 s (MIDI 93) before the note, 10.62 s (MIDI 91) and 10.80 s (MIDI 94) after the bird. Each is 0.22 s of sine with ±12 % frequency warble at 6.4 Hz, level 0.22, send 0.55 — the field is not empty, and it answers in a register the piano cannot.

## 7 · Reverb is room size and distance

A Schroeder room: 6 combs of 1153, 1219, 1301, 1381, 1459, 1523 samples (26.1–34.5 ms), 3 allpasses of 557, 443, 347 samples (12.6, 10.0, 7.9 ms), feedback 0.8 with a 0.72 damping term inside each comb, input ×0.022, return ×3.4, right channel offset by 19 samples for width. That is a decay under a second — a barn, or a field with a stone wall at one end. Deliberately small and dark: a big bright hall would say "sound design", and this film has to sound recorded.

Sends, and what each one claims: the note 0.55 and its sympathetic ring 0.70 (the piano is in a room even outdoors), chirps 0.55 (the far treeline), wingbeats 0.30 (air, not a room), key knock 0.25 and key return 0.20 (an arm's length), cloth 0.20 (on the body), footsteps 0.18–0.25 (dry, close), the wind layers 0.20–0.25 (the air is itself diffuse).

## 8 · Level discipline

- **No whooshes.** Nothing pans across the field at speed. The only pan move in the film is the bird leaving, and it is a documented object on a documented path.
- **No impacts, no explosion sounds, no "cinematic" hits.** The loudest event is a piano note at 0.95; the second loudest is a 180 ms wooden knock at 0.30; the low end is one 42 Hz sine at 0.10, not a sub hit.
- **No two sounds at the same apparent distance.** Every object is placed by three parameters at once — level, filter centre, room send — and they must agree: close = loud, dry, bright; far = quiet, wet, dark. If two sounds share all three, one of them is in the wrong place.
- **Silence is a cue.** The duck is authored (section 5), measured (section 9) and reported as P2 if it fails. A held silence before a single note is the loudest thing in this mix.
- **Master for delivery, not for the meter.** Soft-clip at 1.15, normalise to 0.82, then let `loudnorm` bring the film to −19 LUFS / −1.5 dBTP / LRA 9: a documentary level, not a trailer.

## 9 · Measuring a mix you cannot hear

```bash
node audio/score.mjs
ffmpeg -y -i audio/score.wav -af "highpass=f=28,loudnorm=I=-19:TP=-1.5:LRA=9" -c:a aac -b:a 192k assets/score.m4a
node render.mjs --qa --out=out/qa
```

`render.mjs --qa` calls `analyzeAudio('audio/score.wav', cues, film.duration)` from `scripts/check-audio.mjs`; the numbers land in `out/qa/report.json` under `audio.rms` and `audio.cues`, and in `out/qa/QA_REPORT.md`. Windows are 0.05 s. To read them without the picture sweep:

```bash
node --input-type=module -e "import {readFileSync} from 'node:fs'; import {analyzeAudio} from './scripts/check-audio.mjs'; console.log(analyzeAudio('audio/score.wav', JSON.parse(readFileSync('audio/cues.json','utf8')), 12).stats.rms)"
```

| key | window | what it proves | fail rule |
|---|---|---|---|
| `bed` | mean RMS 0.30–3.60 | the field is alive before anything happens | < 0.002 → P1 `no bed` |
| `preNote` | mean RMS 4.00–4.20 | the air stepped back before the note | > bed × 0.85 → P2 `no silence before the note` |
| `notePeak` | peak 4.24–4.60 | the note exists after the press at 4.235 | < 0.02 → P0 `the note is missing` |
| `noteTail2s` | mean RMS 6.20–6.40 | sound is still there two seconds after the cause | reference only |
| `noteTail` | mean RMS 6.40–7.40 | the tail did not collapse | < 0.0015 → P1 `the note dies too fast` |
| `wing` | mean RMS 9.18–9.70 | the bird is audible over the bed | < bed → P2 `wingbeats under the bed` |
| `end` | mean RMS 11.50–11.95 | the film ends in air, not on a cut | > bed × 0.6 → P2 `no fade at the end` |

**The cue-ratio rule.** For every cue without `masked`/`fade`: `before` = median RMS over `[t−0.45, t−0.13)`, `after` = max RMS over `[t−0.05, t+0.16)`, `ratio = after/before` (9 if `before` ≤ 1e−5 and `after` > 0.002, else 0). A ratio below **0.95** is reported P2 `cue lost in the mix` — the cue was composed and then buried. Onsets are windows above 0.012 whose RMS is 1.6× the mean of the previous two; the nearest onset to each cue is reported as `errMs`, so a cue can be present and still mis-timed. Two cues carry an exception so they cannot fail: `key release` is `masked`, `end of wind` is `fade`.

**The spectrogram** is the only way to see a mix:

```bash
ffmpeg -y -i audio/score.wav -lavfi showspectrumpic=s=1600x900:legend=1 out/check/spectrum.png
```

1. **0–12 s below ~700 Hz:** one continuous band. That is the wind; a gap anywhere before 11.3 s is a broken bed.
2. **3.85–5.35 s:** the band pales and narrows to 28 % (−11 dB). That is `duckAround`; a full-brightness band through 4.2 s means the duck was never applied, and no level meter will tell you.
3. **From 4.235 s, eleven horizontal lines** at 185, 370, 556, 743, 930, 1119, 1309, 1501, 1695, 2089, 2494 Hz, the spacing stretching slightly at the top. The lowest line dims first (τ 0.79 s); by 6 s the surviving energy is a mid plateau; by 11.6 s all of it is gone.
4. **9.18–10.25 s around 0.3–0.4 kHz:** seven soft vertical blobs, energy drifting into the left channel. The wingbeats.
5. **The right edge:** the wind closes from 11.30 and is gone by 11.95, the note stops at 11.635, and the master fade starts at 11.65 with the file ending 0.35 s into it at 0.30 gain — the tail of the film is a fade and a room, not a silence. A wind band still at full brightness after 11.95 means its end envelope is not applied.

## 10 · Cues in the reference film

| cue | t (s) | made by | intent |
|---|---|---|---|
| footstep 1 | 0.16 | thud + rasp | the walk has weight before you can see the boots |
| footstep 5 | 1.96 | thud + rasp | she stops here, not where the picture says she does |
| cloth reach | 3.30 | 3.4 kHz noise, 0.55 s | the arm moves the coat before the hand arrives |
| key press | 4.222 | sine knock 168 → 150 Hz | the action is physical, not symbolic |
| note F#3 | 4.235 | 11 partials, 7.4 s | the one thing the film is about |
| key release | 4.625 | sine knock, `masked` | the key comes back up, quieter than it went down |
| bird takeoff | 9.18 | wingbeat 0 | the film's only event |
| wingbeat 3 | 9.55 | stroke fires at 9.538 | the pan is what makes distance audible |
| end of wind | 11.95 | bed envelope, `fade` | the film ends in air, not on a cut |

Deliberately not cues: the touch at 4.200 and the mechanism at 4.240 (they belong to the key press, not to the edit), wingbeats 2 and 4–7, the sympathetic ring at 4.245, the chirps at 1.05/1.24/10.62/10.80, the note ending at 11.635. Add a cue when the picture has an event; never add one for every sound.
