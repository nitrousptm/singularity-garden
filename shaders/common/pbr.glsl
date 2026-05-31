// ============================================================
// PBR — Cook-Torrance GGX BRDF
// ============================================================

const float PI = 3.14159265359;
const float INV_PI = 0.31830988618;

// GGX/Trowbridge-Reitz Normal Distribution Function
float D_GGX(float NdotH, float roughness) {
    float a  = roughness * roughness;
    float a2 = a * a;
    float d  = NdotH * NdotH * (a2 - 1.0) + 1.0;
    return a2 / (PI * d * d);
}

// Smith's masking-shadowing (height-correlated GGX)
float G_SmithGGX(float NdotV, float NdotL, float roughness) {
    float a  = roughness * roughness;
    float GGXV = NdotL * sqrt(NdotV*NdotV*(1.0-a)+a);
    float GGXL = NdotV * sqrt(NdotL*NdotL*(1.0-a)+a);
    return 0.5 / (GGXV + GGXL + 1e-5);
}

// Schlick Fresnel
vec3 F_Schlick(float VdotH, vec3 F0) {
    return F0 + (1.0 - F0) * pow(clamp(1.0 - VdotH, 0.0, 1.0), 5.0);
}

vec3 F_SchlickRoughness(float VdotN, vec3 F0, float roughness) {
    return F0 + (max(vec3(1.0 - roughness), F0) - F0) * pow(clamp(1.0 - VdotN, 0.0, 1.0), 5.0);
}

// Full Cook-Torrance specular
vec3 cookTorrance(vec3 N, vec3 V, vec3 L, vec3 albedo, float metallic, float roughness) {
    vec3  F0 = mix(vec3(0.04), albedo, metallic);
    vec3  H  = normalize(V + L);

    float NdotL = max(dot(N, L), 0.0);
    float NdotV = max(dot(N, V), 0.0);
    float NdotH = max(dot(N, H), 0.0);
    float VdotH = max(dot(V, H), 0.0);

    float D  = D_GGX(NdotH, roughness);
    float G  = G_SmithGGX(NdotV, NdotL, roughness);
    vec3  F  = F_Schlick(VdotH, F0);

    vec3 spec = (D * G * F);
    vec3 kd   = (1.0 - F) * (1.0 - metallic);

    return (kd * albedo * INV_PI + spec) * NdotL;
}

// Procedural IBL approximation (for SDF scenes without precomputed cubemap)
vec3 envLighting(vec3 N, vec3 V, vec3 albedo, float metallic, float roughness, vec3 skyColor, vec3 groundColor) {
    vec3 F0 = mix(vec3(0.04), albedo, metallic);
    vec3 F  = F_SchlickRoughness(max(dot(N, V), 0.0), F0, roughness);
    vec3 kd = (1.0 - F) * (1.0 - metallic);

    // Diffuse: simple hemisphere blend
    vec3 irradiance = mix(groundColor, skyColor, N.y * 0.5 + 0.5);
    vec3 diffuse    = irradiance * albedo;

    // Specular: reflection over blurred sky
    vec3 R = reflect(-V, N);
    float horizon = pow(1.0 - max(0.0, -R.y), 6.0);
    vec3 specEnv  = mix(skyColor * horizon, skyColor, roughness);
    vec3 specular = specEnv * F;

    return kd * diffuse + specular;
}

// Tone mapping: ACES filmic
vec3 tonemapACES(vec3 x) {
    const float a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14;
    return clamp((x*(a*x+b))/(x*(c*x+d)+e), 0.0, 1.0);
}

// Reinhard extended
vec3 tonemapReinhard(vec3 x, float maxLum) {
    vec3 num = x * (1.0 + x / (maxLum * maxLum));
    return num / (1.0 + x);
}

// Gamma correct
vec3 linearToSRGB(vec3 c) {
    return pow(clamp(c, 0.0, 1.0), vec3(1.0/2.2));
}
