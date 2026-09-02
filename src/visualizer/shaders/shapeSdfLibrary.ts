/**
 * shapeSdfLibrary.ts
 * SoundForm 3D - Signed Distance Field (SDF) Library for Unbounded Field Mode
 *
 * Implements C^1-smooth and exact distance manifolds for:
 * 1. Unbounded Free-Field (Radial expansion, open-space boundary decay)
 * 2. Parametric Superquadric Morphing (continuous curvature e1, e2, pinch, harmonic lobes)
 * 3. Torus (Acoustic Vortex Ring)
 * 4. Octahedron (Diamond Crystal Lattice)
 * 5. Tetrahedron / Pyramid (Regular 4-face simplex)
 * 6. Dodecahedron (Sacred Platonic Solid)
 * 7. Helix (Helical Wavefront / Vortex Beam)
 * 8. Heart (Organic Cardioid Manifold with Taubin distance normalization)
 */

export const SHAPE_SDF_GLSL = `
#ifndef TWO_PI
#define TWO_PI 6.2831853071795864769252867665590
#endif

// ----------------------------------------------------------------------------
// 1. Torus SDF: Ring radius R, Tube radius r
// ----------------------------------------------------------------------------
float sdfTorus(vec3 p, float R, float r) {
    vec2 q = vec2(length(p.xz) - R, p.y);
    return length(q) - r;
}

// ----------------------------------------------------------------------------
// 2. Octahedron (Diamond) SDF: Radius / size s (Inigo Quilez exact metric)
// ----------------------------------------------------------------------------
float sdfOctahedron(vec3 p, float s) {
    vec3 q = abs(p);
    float m = q.x + q.y + q.z - s;
    vec3 v;
    if (3.0 * q.x < m) v = q.xyz;
    else if (3.0 * q.y < m) v = q.yzx;
    else if (3.0 * q.z < m) v = q.zxy;
    else return m * 0.57735027; // 1.0 / sqrt(3.0)
    
    float k = clamp(0.5 * (v.z - v.y + s), 0.0, s);
    return length(vec3(v.x, v.y - s + k, v.z - k));
}

// ----------------------------------------------------------------------------
// 3. Regular Tetrahedron / Pyramid SDF (Exact 4-face regular simplex)
// ----------------------------------------------------------------------------
float sdfTetrahedron(vec3 p, float r) {
    const float k = 0.57735027; // 1.0 / sqrt(3.0)
    vec3 q = p;
    float md = max(max(-q.x - q.y - q.z, q.x + q.y - q.z),
                   max(-q.x + q.y + q.z, q.x - q.y + q.z));
    return (md - r) * k;
}

// ----------------------------------------------------------------------------
// 4. Platonic Dodecahedron SDF (Exact 12-face pentagonal crystal)
// ----------------------------------------------------------------------------
float sdfDodecahedron(vec3 p, float r) {
    const float phi = 1.61803398875;
    const vec3 n1 = normalize(vec3(0.0, 1.0, phi));
    const vec3 n3 = normalize(vec3(phi, 0.0, 1.0));
    const vec3 n5 = normalize(vec3(1.0, phi, 0.0));

    vec3 q = abs(p);
    float d = max(dot(q, n1), max(dot(q, n3), dot(q, n5)));
    return d - r;
}

// ----------------------------------------------------------------------------
// 5. Continuous Superquadric Morphing Manifold
// eps.x = Curvature exponent in east-west (axial)
// eps.y = Curvature exponent in north-south (equatorial)
// pinch = Vertical taper factor [-0.8, 0.8] (e.g. teardrop / cone)
// lobes = Number of radial petals [0.0, 12.0]
// lobeAmp = Amplitude of radial petals [0.0, 0.4]
// ----------------------------------------------------------------------------
float sdfSuperquadric(vec3 p, vec2 eps, vec3 size, float pinch, float lobes, float lobeAmp) {
    // 1. Vertical linear tapering / pinching
    float normY = clamp(p.y / size.y, -1.0, 1.0);
    float taper = 1.0 - pinch * normY * 0.5;
    taper = max(0.08, taper);
    
    vec3 q = p;
    q.xz /= taper;

    // 2. Radial harmonic petals / lobes with singularity guard at origin
    if (lobes > 0.5 && lobeAmp > 0.001) {
        float r2_xz = dot(q.xz, q.xz);
        float theta = r2_xz > 1e-8 ? atan(q.z, q.x) : 0.0;
        float petalMod = 1.0 + lobeAmp * cos(lobes * theta);
        q.xz /= max(0.1, petalMod);
    }

    // 3. Superellipsoid distance inside-outside function F(x, y, z)
    vec3 d = abs(q) / size;
    float e1 = clamp(eps.x, 0.08, 4.0);
    float e2 = clamp(eps.y, 0.08, 4.0);

    float exp2 = 2.0 / e2;
    float exp1 = 2.0 / e1;

    // Numerical safeguard against NaN for small d
    float dx = max(1e-5, d.x);
    float dy = max(1e-5, d.y);
    float dz = max(1e-5, d.z);

    float p_xz = pow(pow(dx, exp2) + pow(dz, exp2), e2 / e1);
    float val = pow(p_xz + pow(dy, exp1), e1 * 0.5);

    float scale = min(size.x, min(size.y, size.z));
    return (val - 1.0) * scale * taper;
}

// ----------------------------------------------------------------------------
// 6. 3D Helical Vortex Tube SDF
// ----------------------------------------------------------------------------
float sdfHelix(vec3 p, float R, float r, float pitch) {
    float r2_xz = dot(p.xz, p.xz);
    float angle = r2_xz > 1e-8 ? atan(p.z, p.x) : 0.0;
    float k = p.y / pitch;
    float n = round(k - angle / TWO_PI);
    float yTarget = (n * TWO_PI + angle) * (pitch / TWO_PI);
    vec3 pOnAxis = vec3(R * cos(angle), yTarget, R * sin(angle));
    return length(p - pOnAxis) - r;
}

// ----------------------------------------------------------------------------
// 7. 3D Cardioid Heart Manifold SDF (Normalized with Taubin First-Order Metric)
// ----------------------------------------------------------------------------
float sdfHeart(vec3 p, float scale) {
    vec3 q = p / scale;
    q.y *= 1.15;
    q.y -= 0.25;
    float x2 = q.x * q.x;
    float y2 = q.y * q.y;
    float z2 = q.z * q.z;
    float z3 = z2 * q.z;
    float a = x2 + 2.25 * y2 + z2 - 1.0;
    float f = a * a * a - (x2 + 0.1125 * y2) * z3;
    
    // Analytical Taubin gradient ||grad f|| for physical metric normalization
    float a2 = a * a;
    vec3 grad;
    grad.x = 6.0 * a2 * q.x - 2.0 * q.x * z3;
    grad.y = 13.5 * a2 * q.y - 0.225 * q.y * z3;
    grad.z = 6.0 * a2 * q.z - 3.0 * (x2 + 0.1125 * y2) * z2;
    
    float gradLen = length(grad);
    return (f / (gradLen + 1e-4)) * scale;
}

// ----------------------------------------------------------------------------
// Master Field Mode SDF Dispatcher
// shapeType:
// 0 = Unbounded Free-Field (open space, radial decay)
// 1 = Superquadric Morphing
// 2 = Torus (Acoustic Vortex Ring)
// 3 = Octahedron (Diamond)
// 4 = Tetrahedron (Pyramid)
// 5 = Dodecahedron (Sacred Geometry)
// 6 = Helix (Vortex Strand)
// 7 = Heart (Cardioid)
// 8 = Custom 3D Mesh (Surface Point Sampler)
// ----------------------------------------------------------------------------
float evaluateFieldShapeSDF(
    vec3 p,
    int shapeType,
    vec4 sqParams,
    float sqLobeAmp,
    float baseSize
) {
    if (shapeType == 0) {
        // Free-field: No boundary clamping
        return -1.0;
    } else if (shapeType == 1) {
        // Parametric Superquadric
        vec2 eps = sqParams.xy;
        float pinch = sqParams.z;
        float lobes = sqParams.w;
        return sdfSuperquadric(p, eps, vec3(baseSize), pinch, lobes, sqLobeAmp);
    } else if (shapeType == 2) {
        // Torus (Vortex Ring)
        float rMajor = baseSize * 0.70;
        float rTube = baseSize * 0.40;
        return sdfTorus(p, rMajor, rTube);
    } else if (shapeType == 3) {
        // Octahedron (Diamond)
        return sdfOctahedron(p, baseSize * 1.35);
    } else if (shapeType == 4) {
        // Tetrahedron (Regular 4-face Simplex)
        return sdfTetrahedron(p, baseSize * 1.45);
    } else if (shapeType == 5) {
        // Dodecahedron
        return sdfDodecahedron(p, baseSize * 1.05);
    } else if (shapeType == 6) {
        // Helix (Vortex)
        return sdfHelix(p, baseSize * 0.70, baseSize * 0.28, baseSize * 0.55);
    } else if (shapeType == 7) {
        // Heart
        return sdfHeart(p, baseSize * 0.85);
    } else if (shapeType == 8) {
        // Custom 3D Mesh: Generous boundary limit to prevent artificial sphere crushing
        return length(p) - baseSize * 2.2;
    }
    return length(p) - baseSize;
}

// Second-order 4-tap tetrahedral stencil for unbiased normal evaluation
vec3 computeFieldShapeNormal(
    vec3 p,
    int shapeType,
    vec4 sqParams,
    float sqLobeAmp,
    float baseSize
) {
    float eps = clamp(0.003 * baseSize, 0.001, 0.005);
    const vec2 k = vec2(1.0, -1.0);
    vec3 grad = 
        k.xyy * evaluateFieldShapeSDF(p + k.xyy * eps, shapeType, sqParams, sqLobeAmp, baseSize) +
        k.yyx * evaluateFieldShapeSDF(p + k.yyx * eps, shapeType, sqParams, sqLobeAmp, baseSize) +
        k.yxy * evaluateFieldShapeSDF(p + k.yxy * eps, shapeType, sqParams, sqLobeAmp, baseSize) +
        k.xxx * evaluateFieldShapeSDF(p + k.xxx * eps, shapeType, sqParams, sqLobeAmp, baseSize);
    float len = length(grad);
    return len > 1e-5 ? grad / len : normalize(p + vec3(1e-4));
}
`;
