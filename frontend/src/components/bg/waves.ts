import { isDarkTheme, type BgEffectDef } from './types'
import { waves2d } from './waves2d'

/**
 * Sóng nước nhìn ngang (WebGL): mọi thứ được tính trong một fragment shader trên GPU.
 * - Mặt sóng = tổng nhiều sóng exp(sin − 1): đỉnh nhọn, bụng rộng như sóng biển thật; tần số cao chạy nhanh hơn.
 * - 3 lớp xa → gần (thị sai): lớp xa nhỏ, chậm, mờ sương; lớp gần đủ chi tiết.
 * - Màu theo độ sâu, ánh sáng xuyên qua đỉnh sóng mỏng, tia nắng xiên, vân sáng caustic gần mặt nước,
 *   bọt trắng mềm ở mép và bạc đầu trên đỉnh cao, ánh phản chiếu, bọt khí nổi lên.
 * Không có WebGL thì quay về bản vẽ 2D.
 */

const VERT = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`

const FRAG = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 uRes;     // kích thước canvas (px canvas)
uniform float uScale;  // px CSS / px canvas
uniform float uTime;
uniform float uDark;   // 0 sáng, 1 tối
uniform float uBoost;  // 1 dịu, ~1.3 mạnh

float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash2(i), hash2(i + vec2(1.0, 0.0)), f.x),
             mix(hash2(i + vec2(0.0, 1.0)), hash2(i + vec2(1.0, 1.0)), f.x), f.y);
}

// Độ cao mặt sóng chuẩn hoá ~[0,1] tại x (px CSS). size < 1 = lớp ở xa (sóng nhỏ, chậm hơn).
float surf(float x, float t, float size, float seed, float detail) {
  x += 40.0 * sin(x * 0.0021 + t * 0.07 + seed); // bẻ cong nhẹ cho đỡ lặp
  float h = 0.0, w = 0.0, amp = 1.0;
  float k = 0.0145 / size;
  float dir = 1.0;
  for (int i = 0; i < 6; i++) {
    float speed = sqrt(k * 9.8 * 60.0) * 0.55 * uBoost; // sóng ngắn chạy nhanh hơn (tán sắc)
    h += amp * exp(sin(x * k + dir * t * speed + seed * float(i + 1)) - 1.0);
    w += amp;
    amp *= mix(0.4, 0.55, detail); // lớp xa ít gợn nhỏ hơn
    k *= 1.83;
    dir = -dir * 0.9 + 0.1;
    x += 13.0;
  }
  return h / w;
}

// Vân sáng caustic: đường gờ của nhiễu bị bẻ cong
float caustic(vec2 p, float t) {
  vec2 w = vec2(noise(p * 0.7 + t * 0.35), noise(p * 0.7 - t * 0.3 + 5.2));
  float n = noise(p + w * 2.2 + vec2(t * 0.25, -t * 0.1));
  return pow(1.0 - abs(n - 0.5) * 2.0, 9.0);
}

// Một lớp nước: trả màu đã nhân alpha (premultiplied)
vec4 layer(vec2 p, float H, float t, float base, float ampPx, float size, float seed, float detail, float haze) {
  float hn = surf(p.x, t, size, seed, detail);
  float sy = base - ampPx * (hn - 0.35);
  float d = p.y - sy; // độ sâu tính từ mặt nước (px CSS), âm = phía trên
  float edge = smoothstep(-0.9 * uScale, 0.9 * uScale, d);
  if (edge <= 0.0) return vec4(0.0);

  // Độ dốc mặt sóng để tính ánh phản chiếu
  float slope = (surf(p.x + 2.0, t, size, seed, detail) - hn) * ampPx * 0.5;

  vec3 shallowL = vec3(0.30, 0.76, 0.84), deepL = vec3(0.04, 0.27, 0.50);
  vec3 shallowD = vec3(0.05, 0.27, 0.38), deepD = vec3(0.01, 0.04, 0.10);
  vec3 shallow = mix(shallowL, shallowD, uDark), deep = mix(deepL, deepD, uDark);
  float depthT = clamp(d / (H * 0.85), 0.0, 1.0);
  vec3 col = mix(shallow, deep, pow(depthT, 0.8));

  // Ánh sáng xuyên qua đỉnh sóng mỏng (màu ngọc)
  float crest = smoothstep(0.55, 1.0, hn);
  col += vec3(0.10, 0.42, 0.36) * crest * exp(-d / (22.0 * size)) * (1.0 - 0.55 * uDark) * detail;

  // Tia nắng xiên xuống, trôi chậm
  float rx = (p.x + d * 0.42) * 0.011;
  float ray = noise(vec2(rx, t * 0.12)) * noise(vec2(rx * 2.3 + 7.0, t * 0.09));
  ray = smoothstep(0.18, 0.62, ray) * exp(-d / (H * 0.45));
  col += vec3(0.55, 0.85, 0.95) * ray * (0.16 - 0.06 * uDark) * detail;

  // Vân sáng caustic ngay dưới mặt nước
  float c = caustic(vec2(p.x * 0.018, d * 0.032) + vec2(0.0, t * 0.05), t);
  col += vec3(0.75, 0.95, 1.0) * c * exp(-d / 28.0) * (0.3 - 0.14 * uDark) * detail;

  // Bọt khí nổi lên (một bọt mỗi cột 38px)
  float cell = floor(p.x / 38.0);
  float hb = hash2(vec2(cell, 3.1));
  if (hb > 0.55 && detail > 0.5) {
    float sp = 0.035 + hb * 0.05;
    float by = H - fract(t * sp + hb * 7.0) * (H - sy + 30.0);
    float bx = cell * 38.0 + 19.0 + sin(t * 1.7 + hb * 20.0) * 6.0;
    float r = 1.6 + hb * 2.6;
    float dist = length(p - vec2(bx, by));
    float ring = smoothstep(r + 0.8, r, dist) * (0.35 + 0.65 * smoothstep(r - 1.6, r, dist));
    col = mix(col, vec3(0.85, 0.97, 1.0), ring * 0.5 * step(sy + 4.0, by));
  }

  // Bọt mép nước mềm + bạc đầu trên đỉnh cao
  float foamN = noise(vec2(p.x * 0.06 + t * 0.6, t * 0.8)) * noise(vec2(p.x * 0.21 - t * 0.9, d * 0.2));
  float foam = exp(-d / (2.2 + 2.0 * size)) * (0.35 + 0.65 * foamN);
  foam += smoothstep(0.78, 1.0, hn) * exp(-d / 9.0) * smoothstep(0.25, 0.7, foamN) * 0.9;
  col = mix(col, vec3(0.94, 0.98, 1.0) - 0.2 * uDark, clamp(foam * detail, 0.0, 0.85));

  // Ánh phản chiếu nơi mặt sóng nghiêng về phía nguồn sáng
  float spec = pow(clamp(-slope * 0.55, 0.0, 1.0), 3.0) * exp(-d / 3.0);
  col += vec3(1.0) * spec * 0.55 * detail;

  // Lớp xa: pha sương cho có chiều sâu
  vec3 hazeCol = mix(vec3(0.78, 0.90, 0.94), vec3(0.10, 0.18, 0.26), uDark);
  col = mix(col, hazeCol, haze);

  float a = edge * mix(0.96, 0.7, haze);
  return vec4(col * a, a);
}

void main() {
  vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) * uScale; // px CSS, gốc ở trên
  float H = uRes.y * uScale;
  float t = uTime;
  float amp = min(H * 0.17, 70.0) * uBoost;

  vec4 acc = layer(p, H, t * 0.7, H * 0.26, amp * 0.4, 0.7, 1.3, 0.0, 0.55);
  vec4 mid = layer(p, H, t * 0.85, H * 0.42, amp * 0.7, 0.75, 4.7, 0.6, 0.25);
  acc = mid + acc * (1.0 - mid.a);
  vec4 near = layer(p, H, t, H * 0.6, amp, 1.0, 9.1, 1.0, 0.0);
  acc = near + acc * (1.0 - near.a);
  gl_FragColor = acc;
}
`

export const waves: BgEffectDef = {
  height: { soft: 0.36, strong: 0.5 },
  scale: () => (window.innerWidth < 700 ? 1 : 1.25),
  create(canvas, level) {
    const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, powerPreference: 'low-power' })
    if (!gl) return waves2d.create(canvas, level)
    const program = buildProgram(gl)
    if (!program) return waves2d.create(canvas, level)

    gl.useProgram(program)
    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    // Một tam giác phủ kín màn hình
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    const aPos = gl.getAttribLocation(program, 'aPos')
    gl.enableVertexAttribArray(aPos)
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0)
    const u = (name: string) => gl.getUniformLocation(program, name)
    const uRes = u('uRes'), uScale = u('uScale'), uTime = u('uTime'), uDark = u('uDark'), uBoost = u('uBoost')
    gl.uniform1f(uBoost, level === 'strong' ? 1.3 : 1)
    gl.clearColor(0, 0, 0, 0)

    let t = 20 + Math.random() * 200
    let dark = isDarkTheme(), themeCheck = 0
    const draw = () => {
      gl.uniform1f(uTime, t)
      gl.uniform1f(uDark, dark ? 1 : 0)
      gl.clear(gl.COLOR_BUFFER_BIT)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
    }

    return {
      resize(w, h) {
        gl.viewport(0, 0, w, h)
        gl.uniform2f(uRes, w, h)
        gl.uniform1f(uScale, window.innerWidth / w)
        draw()
      },
      frame(dt) {
        if (themeCheck++ % 30 === 0) dark = isDarkTheme() // khung đầu + mỗi ~1 giây
        t += dt
        draw()
      },
    }
  },
}

function buildProgram(gl: WebGLRenderingContext) {
  const compile = (type: number, src: string) => {
    const s = gl.createShader(type)
    if (!s) return null
    gl.shaderSource(s, src)
    gl.compileShader(s)
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.warn('[nền sóng] lỗi shader', gl.getShaderInfoLog(s))
      return null
    }
    return s
  }
  const vs = compile(gl.VERTEX_SHADER, VERT), fs = compile(gl.FRAGMENT_SHADER, FRAG)
  const p = gl.createProgram()
  if (!vs || !fs || !p) return null
  gl.attachShader(p, vs)
  gl.attachShader(p, fs)
  gl.linkProgram(p)
  return gl.getProgramParameter(p, gl.LINK_STATUS) ? p : null
}
