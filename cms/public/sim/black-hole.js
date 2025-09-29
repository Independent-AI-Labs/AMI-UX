import { BLACK_HOLE_FRAGMENT_SHADER, BLACK_HOLE_VERTEX_SHADER } from './black-hole-shader.js'

function createContext(canvas) {
  const attributes = { antialias: true, depth: false, stencil: false, alpha: true, premultipliedAlpha: true }
  const gl = canvas.getContext('webgl', attributes) || canvas.getContext('experimental-webgl', attributes)
  return gl
}

function createShader(gl, type, source) {
  const shader = gl.createShader(type)
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader)
    gl.deleteShader(shader)
    throw new Error(`Shader compile failed: ${info || 'unknown error'}`)
  }
  return shader
}

function createProgram(gl, vertexSource, fragmentSource) {
  const program = gl.createProgram()
  const vs = createShader(gl, gl.VERTEX_SHADER, vertexSource)
  const fs = createShader(gl, gl.FRAGMENT_SHADER, fragmentSource)
  gl.attachShader(program, vs)
  gl.attachShader(program, fs)
  gl.linkProgram(program)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program)
    gl.deleteShader(vs)
    gl.deleteShader(fs)
    gl.deleteProgram(program)
    throw new Error(`Program link failed: ${info || 'unknown error'}`)
  }
  gl.deleteShader(vs)
  gl.deleteShader(fs)
  return program
}

function createFullscreenBuffer(gl, program) {
  const positionLocation = gl.getAttribLocation(program, 'aPosition')
  const buffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
  const vertices = new Float32Array([-1, -1, 3, -1, -1, 3])
  gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW)
  gl.enableVertexAttribArray(positionLocation)
  gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0)
  return buffer
}

function createBackgroundTexture(gl) {
  const size = 256
  const data = new Uint8Array(size * size * 4)
  const center = size / 2
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = x - center
      const dy = y - center
      const dist = Math.sqrt(dx * dx + dy * dy) / center
      const base = Math.max(0, 1 - Math.pow(dist, 1.3))
      let intensity = base * 28
      if (Math.random() < 0.0025) intensity = 190 + Math.random() * 45
      const idx = (y * size + x) * 4
      data[idx] = intensity
      data[idx + 1] = intensity
      data[idx + 2] = intensity
      data[idx + 3] = 255
    }
  }
  const texture = gl.createTexture()
  gl.bindTexture(gl.TEXTURE_2D, texture)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, size, size, 0, gl.RGBA, gl.UNSIGNED_BYTE, data)
  return texture
}

function setStaticUniforms(gl, program, texture, options) {
  gl.useProgram(program)
  const uCanvasTexture = gl.getUniformLocation(program, 'uCanvasTexture')
  const uAccretionDisk = gl.getUniformLocation(program, 'uAccretionDisk')
  const uPov = gl.getUniformLocation(program, 'uPov')
  const uMaxIterations = gl.getUniformLocation(program, 'uMaxIterations')
  const uStepSize = gl.getUniformLocation(program, 'uStepSize')

  gl.activeTexture(gl.TEXTURE0)
  gl.bindTexture(gl.TEXTURE_2D, texture)
  gl.uniform1i(uCanvasTexture, 0)

  gl.uniform1f(uAccretionDisk, options.enableAccretionDisk ? 1.0 : 0.0)
  const iterations = options.maxIterations || 320
  gl.uniform1f(uPov, options.pov || 75.0)
  gl.uniform1i(uMaxIterations, iterations)
  gl.uniform1f(uStepSize, 2.5 / iterations)
}

function updateResolution(gl, resolutionLocation, canvas, scale) {
  const rect = canvas.getBoundingClientRect()
  const dpr = Math.min(3, window.devicePixelRatio || 1)
  const ratio = Math.max(0.3, Math.min(scale || 1, 2.5))
  const width = Math.max(1, Math.round(rect.width * dpr * ratio))
  const height = Math.max(1, Math.round(rect.height * dpr * ratio))
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width
    canvas.height = height
  }
  gl.viewport(0, 0, canvas.width, canvas.height)
  gl.uniform2f(resolutionLocation, canvas.width, canvas.height)
  return { width: canvas.width, height: canvas.height }
}

function animate(gl, program, canvas, resolutionLocation, options) {
  const uCameraTranslate = gl.getUniformLocation(program, 'uCameraTranslate')
  let frameId = null
  const onFps = typeof options.onFps === 'function' ? options.onFps : null
  let fpsFrames = 0
  let fpsWindowStart = performance.now()

  function renderFrame(now) {
    if (!gl || gl.isContextLost()) return
    updateResolution(gl, resolutionLocation, canvas, options.resolutionScale)
    const t = now * 0.001
    const swing = options.cameraSwing || 0.85
    const x = Math.sin(t * 0.42) * swing
    const y = Math.cos(t * 0.21) * swing * 0.18
    const z = Math.sin(t * 0.17) * 0.12
    gl.uniform3f(uCameraTranslate, x, y, z)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
    if (onFps) {
      fpsFrames += 1
      const elapsed = now - fpsWindowStart
      if (elapsed >= 400) {
        const fps = (fpsFrames * 1000) / (elapsed || 1)
        try {
          onFps(fps)
        } catch {}
        fpsFrames = 0
        fpsWindowStart = now
      }
    }
    frameId = window.requestAnimationFrame(renderFrame)
  }

  frameId = window.requestAnimationFrame(renderFrame)

  return () => {
    if (frameId != null) window.cancelAnimationFrame(frameId)
  }
}

export function attachBlackHoleSimulation(canvas, options = {}) {
  if (!canvas || typeof canvas.getContext !== 'function') return () => {}
  const gl = createContext(canvas)
  if (!gl) return () => {}

  const program = createProgram(gl, BLACK_HOLE_VERTEX_SHADER, BLACK_HOLE_FRAGMENT_SHADER)
  gl.useProgram(program)
  gl.disable(gl.DEPTH_TEST)
  gl.clearColor(0, 0, 0, 0)
  createFullscreenBuffer(gl, program)
  const texture = createBackgroundTexture(gl)
  const config = {
    enableAccretionDisk: options.enableAccretionDisk !== false,
    maxIterations: options.maxIterations || 320,
    pov: options.pov || 75,
    cameraSwing: options.cameraSwing || 0.9,
    resolutionScale: options.resolutionScale || 1.7,
    onFps: typeof options.onFps === 'function' ? options.onFps : null,
  }
  setStaticUniforms(gl, program, texture, config)
  const uResolution = gl.getUniformLocation(program, 'uResolution')
  updateResolution(gl, uResolution, canvas, config.resolutionScale)

  const resize = () => {
    if (!gl || gl.isContextLost()) return
    gl.useProgram(program)
    updateResolution(gl, uResolution, canvas, config.resolutionScale)
  }

  window.addEventListener('resize', resize, { passive: true })

  const cleanupAnimation = animate(gl, program, canvas, uResolution, config)

  const handleContextLost = (event) => {
    event.preventDefault()
    cleanupAnimation()
    window.removeEventListener('resize', resize)
  }

  canvas.addEventListener('webglcontextlost', handleContextLost, false)

  return () => {
    cleanupAnimation()
    window.removeEventListener('resize', resize)
    canvas.removeEventListener('webglcontextlost', handleContextLost)
    if (!gl.isContextLost()) {
      gl.bindTexture(gl.TEXTURE_2D, null)
      gl.useProgram(null)
    }
    if (typeof config.onFps === 'function') {
      try {
        config.onFps(0)
      } catch {}
    }
  }
}
