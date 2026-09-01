/**
 * Cymatics, Spherical Harmonics, Bessel & Apple OKLab Optical GLSL Core Functions
 */

export const CYMATICS_CORE_GLSL = `
#define PI 3.1415926535897932384626433832795
#define TWO_PI 6.2831853071795864769252867665590
#define HALF_PI 1.5707963267948966192313216916398

// ----------------------------------------------------------------------------
// Perceptual OKLab Color Space Conversion & Chroma-Preserving Glow
// ----------------------------------------------------------------------------
vec3 linearRgbToOklab(vec3 c) {
    float l = 0.4122214708 * c.r + 0.5363325363 * c.g + 0.0514459929 * c.b;
    float m = 0.2119034982 * c.r + 0.6806995451 * c.g + 0.1073969566 * c.b;
    float s = 0.0883024619 * c.r + 0.2817188376 * c.g + 0.6299787005 * c.b;

    float l_ = pow(max(0.0, l), 1.0 / 3.0);
    float m_ = pow(max(0.0, m), 1.0 / 3.0);
    float s_ = pow(max(0.0, s), 1.0 / 3.0);

    return vec3(
        0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_,
        1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_,
        0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_
    );
}

vec3 oklabToLinearRgb(vec3 lab) {
    float l_ = lab.x + 0.3963377774 * lab.y + 0.2158037573 * lab.z;
    float m_ = lab.x - 0.1055613458 * lab.y - 0.0638541728 * lab.z;
    float s_ = lab.x - 0.0894841775 * lab.y - 1.2914855480 * lab.z;

    float l = l_ * l_ * l_;
    float m = m_ * m_ * m_;
    float s = s_ * s_ * s_;

    return vec3(
        +4.0767439362 * l - 3.3077115913 * m + 0.2309699292 * s,
        -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
        -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
    );
}

// Inigo Quilez Cosine Palette with Optional OKLab Gamut Smoothing
vec3 cosinePalette(float t, vec3 a, vec3 b, vec3 c, vec3 d) {
    return a + b * cos(TWO_PI * (c * t + d));
}

vec3 oklabCosinePalette(float t, vec3 a, vec3 b, vec3 c, vec3 d) {
    vec3 labA = linearRgbToOklab(a);
    vec3 labB = linearRgbToOklab(b);
    vec3 lab = labA + labB * cos(TWO_PI * (c * t + d));
    return clamp(oklabToLinearRgb(lab), 0.0, 1.0);
}

// Apple-Style Luminous Radiance Flare with Soft Chroma-Preserving Shoulder
vec3 appleRadiantGlow(vec3 baseColor, float intensity, float coreHotness) {
    vec3 lab = linearRgbToOklab(baseColor);
    lab.x = clamp(lab.x * (1.0 + intensity * 0.45), 0.0, 1.0);
    lab.y *= 1.0 + intensity * 0.15;
    lab.z *= 1.0 + intensity * 0.15;
    vec3 boostedColor = oklabToLinearRgb(lab);
    
    vec3 hotCoreColor = mix(boostedColor, vec3(1.0, 0.98, 0.95), smoothstep(0.7, 2.5, intensity) * coreHotness);
    return hotCoreColor * (1.0 + intensity * 0.75);
}

// ----------------------------------------------------------------------------
// Singularity-Free Orthonormal Basis (Frisvad / Duff formulation)
// ----------------------------------------------------------------------------
void buildOrthonormalBasis(vec3 n, out vec3 b1, out vec3 b2) {
    if (n.z < -0.9999999) {
        b1 = vec3(0.0, -1.0, 0.0);
        b2 = vec3(-1.0, 0.0, 0.0);
        return;
    }
    float a = 1.0 / (1.0 + n.z);
    float b = -n.x * n.y * a;
    b1 = vec3(1.0 - n.x * n.x * a, b, -n.x);
    b2 = vec3(b, 1.0 - n.y * n.y * a, -n.y);
}

// ----------------------------------------------------------------------------
// Henyey-Greenstein Anisotropic Scattering Phase Function
// g > 0 forward Mie scattering (luminous glare toward acoustic emitters)
// ----------------------------------------------------------------------------
float henyeyGreensteinPhase(float cosTheta, float g) {
    float g2 = g * g;
    return (1.0 - g2) / (4.0 * PI * pow(max(0.0001, 1.0 + g2 - 2.0 * g * cosTheta), 1.5));
}

// ----------------------------------------------------------------------------
// Real Spherical Harmonics (Degrees l = 0, 1, 2, 3) in Cartesian Coordinates
// Evaluates on normalized unit vector n = (x, y, z)
// ----------------------------------------------------------------------------
vec4 evalSH_L0_L1(vec3 n) {
    return vec4(
        0.28209479177387814,          // Y0,0
        0.4886025119029199 * n.y,    // Y1,-1
        0.4886025119029199 * n.z,    // Y1,0
        0.4886025119029199 * n.x     // Y1,1
    );
}

void evalSH_L2(vec3 n, out float Y2[5]) {
    float xy = n.x * n.y;
    float yz = n.y * n.z;
    float xz = n.x * n.z;
    float z2 = n.z * n.z;
    float x2_y2 = n.x * n.x - n.y * n.y;

    Y2[0] = 1.0925484305920792 * xy;
    Y2[1] = 1.0925484305920792 * yz;
    Y2[2] = 0.3153915652525200 * (3.0 * z2 - 1.0);
    Y2[3] = 1.0925484305920792 * xz;
    Y2[4] = 0.5462742152960396 * x2_y2;
}

void evalSH_L3(vec3 n, out float Y3[7]) {
    float x = n.x, y = n.y, z = n.z;
    float x2 = x * x, y2 = y * y, z2 = z * z;

    Y3[0] = 0.5900435899266435 * y * (3.0 * x2 - y2);
    Y3[1] = 2.8906114426405540 * x * y * z;
    Y3[2] = 0.4570457994644658 * y * (5.0 * z2 - 1.0);
    Y3[3] = 0.3731763325901154 * z * (5.0 * z2 - 3.0);
    Y3[4] = 0.4570457994644658 * x * (5.0 * z2 - 1.0);
    Y3[5] = 1.4453057213202770 * z * (x2 - y2);
    Y3[6] = 0.5900435899266435 * x * (x2 - 3.0 * y2);
}

// ----------------------------------------------------------------------------
// Numerically Stable Spherical Bessel Functions j_l(u) for u = k * r
// ----------------------------------------------------------------------------
float sphericalBessel_j0(float u) {
    if (abs(u) < 0.001) {
        float u2 = u * u;
        return 1.0 - u2 * (1.0 / 6.0) + u2 * u2 * (1.0 / 120.0);
    }
    return sin(u) / u;
}

float sphericalBessel_j1(float u) {
    if (abs(u) < 0.001) {
        float u2 = u * u;
        return u * (1.0 / 3.0) - u * u2 * (1.0 / 30.0);
    }
    return (sin(u) - u * cos(u)) / (u * u);
}

float sphericalBessel_j2(float u) {
    if (abs(u) < 0.001) {
        float u2 = u * u;
        return u2 * (1.0 / 15.0) - u2 * u2 * (1.0 / 210.0);
    }
    float u2 = u * u;
    float u3 = u2 * u;
    return (3.0 / u3 - 1.0 / u) * sin(u) - (3.0 / u2) * cos(u);
}

float sphericalBessel_j3(float u) {
    if (abs(u) < 0.001) {
        float u2 = u * u;
        return u * u2 * (1.0 / 105.0) - u * u2 * u2 * (1.0 / 1890.0);
    }
    float u2 = u * u;
    float u3 = u2 * u;
    float u4 = u2 * u2;
    return (15.0 / u4 - 6.0 / u2) * sin(u) - (15.0 / u3 - 1.0 / u) * cos(u);
}

// ----------------------------------------------------------------------------
// Full 3D Cymatics Displacement Field
// ----------------------------------------------------------------------------
float evaluateCymaticsDisplacement(
    vec3 p, 
    vec4 bandEnergies0_3, // x=Sub, y=Bass, z=LowMid, w=Mid
    vec2 bandEnergies4_5, // x=HighMid, y=High
    float globalWavenumber,
    float time
) {
    float r = length(p);
    if (r < 0.0001) return 0.0;
    vec3 n = p / r;

    // Evaluate Spherical Harmonics
    vec4 sh01 = evalSH_L0_L1(n);
    float sh2[5]; evalSH_L2(n, sh2);
    float sh3[7]; evalSH_L3(n, sh3);

    // Compute radial Bessel standing modes
    float u = globalWavenumber * r;
    float j0 = sphericalBessel_j0(u);
    float j1 = sphericalBessel_j1(u * 1.4);
    float j2 = sphericalBessel_j2(u * 2.0);
    float j3 = sphericalBessel_j3(u * 2.8);

    // Dynamic standing wave interference
    float mode0 = bandEnergies0_3.x * j0 * sh01.x * 2.5;
    float mode1 = bandEnergies0_3.y * j1 * (sh01.y * sin(time * 2.0) + sh01.w * cos(time * 2.0));
    float mode2 = bandEnergies0_3.z * j2 * (sh2[0] + sh2[2] * 0.8 + sh2[4]);
    float mode3 = bandEnergies0_3.w * j3 * (sh3[0] + sh3[3] + sh3[6]);

    // High frequency 3D Chladni ripple
    float chladni = (cos(n.x * 12.0) * cos(n.y * 12.0) * cos(n.z * 12.0)) * bandEnergies4_5.x * 0.3;

    return (mode0 + mode1 + mode2 + mode3 + chladni) * (1.0 / (1.0 + 0.12 * r));
}
`;

