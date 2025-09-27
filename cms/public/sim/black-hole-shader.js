export const BLACK_HOLE_VERTEX_SHADER = String.raw`
attribute vec2 aPosition;
void main() {
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

export const BLACK_HOLE_FRAGMENT_SHADER = String.raw`
precision highp float;
precision highp int;
#define SPEED_OF_LIGHT 1.0
#define EVENT_HORIZON_RADIUS 1.0
#define BACKGROUND_DISTANCE 10000.0
#define PROJECTION_DISTANCE 1.0
#define SCALE_FACTOR 1.0
#define PI 3.14159265359

uniform float uAccretionDisk;
uniform sampler2D uCanvasTexture;
uniform vec2 uResolution;
uniform vec3 uCameraTranslate;
uniform float uPov;
uniform int uMaxIterations;
uniform float uStepSize;

vec3 bh_pos = vec3(0.0, 0.0, 0.0);
vec3 camera_pos = vec3(0.0, 0.05, 20.0);

float innerDiskRadius = 2.0;
float outerDiskRadius = 8.0;

float diskFactor = 3.0;
float disk_flow = 10.0;
float flow_rate = 0.6;

mat4 translate_RowOrder(float x, float y, float z) {
  return mat4(
    1.0, 0.0, 0.0, 0.0,
    0.0, 1.0, 0.0, 0.0,
    0.0, 0.0, 1.0, 0.0,
    x, y, z, 1.0
  );
}

mat4 scale(float x, float y, float z) {
  return mat4(
    x, 0.0, 0.0, 0.0,
    0.0, y, 0.0, 0.0,
    0.0, 0.0, z, 0.0,
    0.0, 0.0, 0.0, 1.0
  );
}

mat4 rotate_x(float theta) {
  return mat4(
    1.0, 0.0, 0.0, 0.0,
    0.0, cos(theta), -sin(theta), 0.0,
    0.0, sin(theta), cos(theta), 0.0,
    0.0, 0.0, 0.0, 1.0
  );
}

mat4 rotate_y(float theta) {
  return mat4(
    cos(theta), 0.0, sin(theta), 0.0,
    0.0, 1.0, 0.0, 0.0,
    -sin(theta), 0.0, cos(theta), 0.0,
    0.0, 0.0, 0.0, 1.0
  );
}

float hash(float n) {
  return fract(sin(n) * 753.5453123);
}

float noise(vec3 x) {
      vec3 p = floor(x);
      vec3 f = fract(x);
      f = f * f * (3.0 - 2.0 * f);
      float n = p.x + p.y * 157.0 + 113.0 * p.z;
      return mix(
        mix(mix(hash(n + 0.0), hash(n + 1.0), f.x), mix(hash(n + 157.0), hash(n + 158.0), f.x), f.y),
        mix(mix(hash(n + 113.0), hash(n + 114.0), f.x), mix(hash(n + 270.0), hash(n + 271.0), f.x), f.y),
        f.z
      );
}

float hash13(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.yzx + 33.333);
  return fract((p.x + p.y) * p.z);
}

float fbm(vec3 pos) {
  float value = 0.0;
  float amplitude = 0.5;
  float frequency = 1.0;
  for (int i = 0; i < 4; ++i) {
    value += noise(pos * frequency) * amplitude;
    frequency *= 2.2;
    amplitude *= 0.55;
  }
  return value;
}

struct Ray {
  vec4 origin;
  vec4 direction;
};

Ray pixelToWorldRay(vec2 fragCoord) {
  vec3 up = vec3(0.0, 1.0, 0.0);
  vec4 look_from = rotate_y(camera_pos.x + uCameraTranslate.x) * rotate_x(camera_pos.y + uCameraTranslate.y) * vec4(camera_pos + uCameraTranslate, 1.0);
  vec3 view = vec3(-look_from.x, -look_from.y, -look_from.z);
  vec3 n_view = normalize(view);
  vec3 n_upview = normalize(cross(up, n_view));
  vec3 c_vup = cross(n_view, n_upview);
  mat4 offset = mat4(
    vec4(n_upview, 0.0),
    vec4(c_vup, 0.0),
    vec4(n_view, 0.0),
    vec4(0.0, 0.0, 0.0, 1.0)
  );
  mat4 transform = translate_RowOrder(-0.5 * uResolution.x, -0.5 * uResolution.y, PROJECTION_DISTANCE);
  mat4 look_transform = translate_RowOrder(look_from.x, look_from.y, look_from.z);
  float pov_rad = radians(uPov);
  float h = PROJECTION_DISTANCE * 2.0 * tan(0.5 * pov_rad);
  mat4 scaled_transform = scale(
    h / (uResolution.y * SCALE_FACTOR),
    h / (uResolution.y * SCALE_FACTOR),
    1.0
  );
  vec4 local_pixel_coord = vec4(fragCoord.xy, 0.0, 1.0);
  vec4 world_coord = look_transform * offset * scaled_transform * transform * local_pixel_coord;
  Ray ray;
  ray.origin = look_from;
  ray.direction = world_coord - look_from;
  return ray;
}

vec3 geodesic_equation(vec3 position, float h2) {
  return -(3.0 / 2.0) * h2 * position / pow(length(position), 5.0);
}

vec4 intersect_sphere(Ray ray, float radius) {
  float a = dot(ray.direction, ray.direction);
  float b = dot(ray.direction, ray.origin) * 2.0;
  float c = dot(ray.origin, ray.origin) - radius * radius;
  float d = b * b - 4.0 * a * c;
  float q = -0.5 * (b + sign(b) * sqrt(max(d, 0.0)));
  float r1 = q / a;
  float r2 = c / q;
  float i = max(r1, r2);
  return ray.origin + i * ray.direction;
}

vec4 sampleBackground(Ray ray) {
  vec4 positioned = intersect_sphere(ray, BACKGROUND_DISTANCE);
  float dist = length(vec2(positioned.x, positioned.z));
  float theta = atan(positioned.x, positioned.z);
  float new_z = positioned.y;
  vec2 new_coord = vec2(theta / PI + 0.5, new_z / (2.0 * BACKGROUND_DISTANCE) + 0.5);
  return texture2D(uCanvasTexture, new_coord);
}

vec4 compute(inout vec3 position, inout vec3 velocity, inout Ray ray) {
  vec3 perpendicular = cross(position, velocity);
  float mag = length(perpendicular);
  float h2 = pow(mag, 2.0);

  for (int i = 0; i < 2000; i++) {
    if (i >= uMaxIterations) break;
    float dist = length(position);
    float step_size = dist * dist * uStepSize;
    vec3 rk_delta = velocity * step_size;
    vec3 k1 = step_size * geodesic_equation(position, h2);
    vec3 k2 = step_size * geodesic_equation(position + rk_delta + 0.5 * k1, h2);
    vec3 k3 = step_size * geodesic_equation(position + rk_delta + 0.5 * k2, h2);
    vec3 k4 = step_size * geodesic_equation(position + rk_delta + k3, h2);
    vec3 d = (k1 + 2.0 * (k2 + k3) + k4) / 6.0;
    vec3 ray_step = position + rk_delta + d * uStepSize;

    if (uAccretionDisk == 1.0 && dist > innerDiskRadius && dist < outerDiskRadius && ray_step.y * position.y < pow(uStepSize, diskFactor)) {
      float deltaDiskRadius = outerDiskRadius - innerDiskRadius;
      float disk_dist = dist - innerDiskRadius;
      vec3 uvw = vec3(
        (atan(ray_step.z, abs(ray_step.x)) / (PI * 2.0)) - (disk_flow / sqrt(dist)),
        pow(disk_dist / deltaDiskRadius, 2.0) + ((flow_rate / (PI * 2.0)) / deltaDiskRadius),
        ray_step.y * 0.5 + 0.5
      ) / 2.0;
      float disk_intensity = 1.0 - length(ray_step / vec3(outerDiskRadius, 1.0, outerDiskRadius));
      disk_intensity *= smoothstep(innerDiskRadius, innerDiskRadius + 1.0, dist);
      uvw.y += uCameraTranslate.x;
      uvw.z += uCameraTranslate.x;
      uvw.x -= uCameraTranslate.x;
      float density_variation = fbm(position + uvw * 2.0);
      density_variation = mix(density_variation, noise(uvw * 6.0), 0.55);
      disk_intensity *= inversesqrt(max(dist, 1e-3)) * density_variation;
      float dpth = step_size * (float(uMaxIterations) / 10.0) * disk_intensity;
      vec3 shiftD = 0.6 * cross(normalize(ray_step), vec3(0.0, 1.0, 0.0));
      float v = dot(ray.direction.xyz, shiftD);
      float dopplerShift = sqrt((1.0 - v) / (1.0 + v));
      float redshift = sqrt((1.0 - 2.0 / dist) / (1.0 - 2.0 / length(camera_pos)));
      float sparkSeed = hash13(vec3(ray_step.x, ray_step.z, dist));
      float radialMask = smoothstep(innerDiskRadius, innerDiskRadius + 0.8, dist) * (1.0 - smoothstep(outerDiskRadius - 1.1, outerDiskRadius + 0.25, dist));
      float spark = smoothstep(0.88, 1.0, sparkSeed) * radialMask;
      float luminance = dopplerShift * redshift * dpth + spark * 0.85;
      vec3 color_rgb = vec3(luminance);
      ray.origin = vec4(position, 1.0);
      ray.direction = vec4(velocity, 0.0);
      vec4 disk_color = sampleBackground(ray) + vec4(color_rgb, 1.0);
      return disk_color;
    }

    if (dist >= BACKGROUND_DISTANCE) {
      break;
    }
    if (dist <= EVENT_HORIZON_RADIUS) {
      return vec4(0.0, 0.0, 0.0, 1.0);
    }
    position += rk_delta;
    velocity += d;
  }

  ray.origin = vec4(position, 1.0);
  ray.direction = vec4(velocity, 0.0);
  return sampleBackground(ray);
}

vec3 sampleScene(vec2 fragCoord) {
  Ray ray = pixelToWorldRay(fragCoord);
  vec3 position = vec3(ray.origin);
  vec3 velocity = SPEED_OF_LIGHT * normalize(vec3(ray.direction));
  vec4 color = compute(position, velocity, ray);
  vec3 baseColor = clamp(color.rgb, 0.0, 1.0);
  float glow = clamp(0.012 / length(ray.origin), 0.0, 1.0) * 4.2;
  return clamp(baseColor + vec3(glow), 0.0, 1.0);
}

void main() {
  const float AA_SPAN = 0.6;
  vec2 fragCoord = gl_FragCoord.xy;
  vec3 accum = sampleScene(fragCoord);
  accum += sampleScene(fragCoord + vec2( AA_SPAN,  AA_SPAN));
  accum += sampleScene(fragCoord + vec2(-AA_SPAN,  AA_SPAN));
  accum += sampleScene(fragCoord + vec2( AA_SPAN, -AA_SPAN));
  accum += sampleScene(fragCoord + vec2(-AA_SPAN, -AA_SPAN));
  vec3 sceneColor = accum / 5.0;
  float luminance = max(sceneColor.r, max(sceneColor.g, sceneColor.b));
  float opacity = pow(clamp(1.0 - luminance, 0.0, 1.0), 0.82);
  vec3 inverted = vec3(1.0) - sceneColor;
  vec3 finalColor = inverted * luminance;
  gl_FragColor = vec4(finalColor, opacity);
}
`;
