The board digitizes a probe voltage three ways: V1 and V2 feed the ESP32's 12-bit ADC (V1 through auto-ranging gain stages, V2 directly), and V3 uses a 16-bit ADS8681. Transfer functions, sampling, quantization and a little firmware algebra explain how well each works. Every number below is theory (schematic and datasheet typical values), not a bench measurement.

### The front end as transfer functions

The Laplace transform turns a circuit into algebra. A capacitor becomes an impedance $`1/(sC)`$, and output over input is the transfer function $`H(s)`$. Here $`s`$ is a complex frequency: for a steady sine, $`s = j2\pi f`$ and $`\lvert H \rvert`$ is the gain at $`f`$. Most of the analog chain is a single pole, the simplest low-pass filter:

```math
H(s) = \frac{1}{1 + s\tau}, \qquad f_{-3\,\text{dB}} = \frac{1}{2\pi\tau}
```

$`\tau`$ is the time constant and $`f_{-3\,\text{dB}}`$ the bandwidth. A step rises (10–90%) in about $`0.35/f_{-3\,\text{dB}}`$.

An op-amp with negative feedback trades gain for bandwidth:

```math
f_\text{CL} = \frac{\text{GBW}}{\text{noise gain}}
```

$`f_\text{CL}`$ is the closed-loop bandwidth and GBW the op-amp's gain-bandwidth product. With the TSV794's 50 MHz GBW, the level shifter (noise gain 2) reaches 25 MHz, a 14 ns rise time. An inverting stage of gain $`-G`$ has noise gain $`1 + G`$, so the gain stages (6.5 and 3.36) reach 7.7 and 14.9 MHz. The ADS8681's internal filter is far slower: it rolls off at about 15 kHz and delays the signal by about 14 µs.

### Sampling and aliasing

Sampling keeps one value every $`T = 1/f_s`$ seconds, where $`f_s`$ is the sample rate. The Nyquist theorem says samples at $`f_s \gt 2B`$ fully capture a signal with no content above $`B`$. A sine above $`f_s/2`$ does not vanish. It folds back:

```math
f_\text{alias} = \lvert f - \ell f_s \rvert
```

$`f`$ is the input frequency and $`\ell`$ the whole number that puts $`\ell f_s`$ closest to $`f`$. At the default 10 kS/s, a 12 kHz input shows up as 2 kHz, and the trigger treats it as real.

The ESP32 paths have no filter before the ADC, and their analog bandwidth (several MHz) is 500 to 5000 times $`f_s/2 = 5\,\text{kHz}`$. Tones and noise far above 5 kHz fold into the trace. The ADS8681's filter is 26 dB down at 100 kHz, so far less wideband noise reaches V3. V3 still aliases at 10 kS/s, though: a 12 kHz tone loses only 2 dB and folds to 2 kHz.

### Resolution and noise

An $`N`$-bit ADC rounds each sample to one of $`2^N`$ steps, and the rounding error acts like noise:

```math
\text{LSB} = \frac{\text{FSR}}{2^N}, \qquad \sigma_q = \frac{\text{LSB}}{\sqrt{12}}
```

FSR is the full-scale range, LSB (least significant bit) the step size and $`\sigma_q`$ the rms quantization noise. The ADS8681's ±2.56 V range (5.12 V full scale) over $`2^{16}`$ codes gives 78.125 µV per step. For a full-scale sine, the signal-to-quantization-noise ratio (SQNR) grows about 6 dB per bit:

```math
\text{SQNR} = 6.02N + 1.76\ \text{dB}
```

That is 74.0 dB for 12 bits and 98.1 dB for 16. Independent noise sources add in quadrature ($`\sqrt{\sigma_1^2 + \sigma_2^2}`$), and averaging $`M`$ samples divides the noise by $`\sqrt{M}`$: 16 samples buy 2 extra bits.

Dynamic range is the largest usable sine over the noise floor. Referred to the probe, and taking the ESP32 ADC's own noise as 2 LSB:

| Path | Step | Noise (rms) | Dynamic range |
|---|---|---|---|
| V2 direct | 1 mV | 1.65 mV | 55 dB |
| V1 stage 2 | 0.42 mV | 0.75 mV | 62 dB |
| V1 stage 1 (never selected as drawn) | 0.18 mV | 0.33 mV | 69 dB |
| V3 ADS8681 | 78 µV | 57 µV | 86 dB |

A gain stage shrinks signal range and noise alike, so on its own it adds no dynamic range. The V1 figures pair it with V2: V2's largest signal over the stage's lower noise floor. The ADS8681 beats both at every amplitude.

### The math in the firmware

The firmware undoes the front end with one straight line per path:

```math
V_\text{in} = \frac{V_\text{adc} - V_\text{off}}{g}
```

$`V_\text{adc}`$ is the reading, $`V_\text{off}`$ the offset and $`g`$ the gain. The inverting stages store signed gains ($`-5.5`$ and $`-2.36`$), so the line also undoes the inversion. Calibration takes $`V_\text{off}`$ and $`g`$ from a shorted input and one known voltage. The gain stages instead get a least-squares line fit against V2 over a slow sweep.

Auto-ranging is a little Boolean algebra. Two window comparators set $`W_1 = 1`$ inside window 1 and $`W_2 = 1`$ inside window 2. A 5k/2k/5k divider on the 3.3 V supply $`V_{DD}`$ puts window 1 at $`\pm V_{DD}/12 = \pm 0.275\,\text{V}`$ at the probe. Window 2 is ±0.70 V by design. The flags drive the select pins of a CD4052 multiplexer, $`S_A = W_1`$ and $`S_B = W_2`$, which route the signal into one gain stage:

```math
\text{channel} = 2S_B + S_A
```

The windows are nested, so a signal inside window 1 sets both flags and selects channel 3, which is unconnected. Stage 1 sits on channel 1, which needs $`W_1 = 1`$ with $`W_2 = 0`$, and nesting rules that out. **As drawn, gain stage 1 can never be selected.** Driving $`S_B`$ with $`W_1 \oplus W_2`$ (one XOR gate), or moving stage 1 to channel 3, fixes it.

The full derivations and the rest of the numbers are in [the Theory and math chapter of the Oscilloscope README](https://github.com/krishpatelkp2423-dot/Oscilloscope#theory-and-math).
