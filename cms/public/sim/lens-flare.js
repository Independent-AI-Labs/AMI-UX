const TWO_PI = Math.PI * 2

function createHexagonPath(ctx, radius) {
  const step = TWO_PI / 6
  ctx.beginPath()
  for (let i = 0; i < 6; i += 1) {
    const angle = step * i
    const x = Math.cos(angle) * radius
    const y = Math.sin(angle) * radius
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.closePath()
}

function createParticles(count, width, height) {
  const particles = []
  for (let i = 0; i < count; i += 1) {
    const size = 12 + Math.random() * 20
    particles.push({
      x: (Math.random() - 0.5) * width * 0.8,
      y: (Math.random() - 0.5) * height * 0.8,
      baseSize: size,
      wobble: 0.25 + Math.random() * 0.44,
      spin: (Math.random() - 0.5) * 0.0018,
      driftX: (Math.random() - 0.5) * 0.05,
      driftY: (Math.random() - 0.5) * 0.06,
      hue: 188 + Math.random() * 34,
      alpha: 0.14 + Math.random() * 0.18,
      phase: Math.random() * TWO_PI,
    })
  }
  return particles
}

export function attachLensFlare(canvas, options = {}) {
  if (!canvas || typeof canvas.getContext !== 'function') return () => {}
  const ctx = canvas.getContext('2d')
  if (!ctx) return () => {}

  const particles = createParticles(options.count || 12, canvas.width || 72, canvas.height || 72)
  let frameId = null
  let running = true

  function resize() {
    const ratio = Math.min(3, window.devicePixelRatio || 1)
    const rect = canvas.getBoundingClientRect()
    const width = rect.width || (options.width || 72)
    const height = rect.height || (options.height || 72)
    const targetW = Math.max(1, Math.round(width * ratio))
    const targetH = Math.max(1, Math.round(height * ratio))
    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW
      canvas.height = targetH
    }
  }

  function render(now) {
    if (!running) return
    resize()
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.save()
    ctx.translate(canvas.width / 2, canvas.height / 2)
    ctx.globalCompositeOperation = 'lighter'

    for (const particle of particles) {
      const time = now * 0.001 + particle.phase
      const pulse = 0.5 + Math.sin(time * particle.wobble) * 0.18 + Math.sin(time * 0.7) * 0.08
      const size = particle.baseSize * (0.7 + pulse * 0.6)

      particle.x += particle.driftX
      particle.y += particle.driftY

      if (particle.x > canvas.width * 0.5 || particle.x < -canvas.width * 0.5) particle.driftX *= -1
      if (particle.y > canvas.height * 0.5 || particle.y < -canvas.height * 0.5) particle.driftY *= -1

      ctx.save()
      ctx.translate(particle.x - canvas.width / 2, particle.y - canvas.height / 2)
      ctx.rotate(time * particle.spin * 80)

      const gradient = ctx.createRadialGradient(0, 0, size * 0.1, 0, 0, size)
      gradient.addColorStop(0, `hsla(${particle.hue}, 90%, 88%, ${particle.alpha})`)
      gradient.addColorStop(0.32, `hsla(${particle.hue + 18}, 80%, 76%, ${particle.alpha * 0.75})`)
      gradient.addColorStop(0.72, `hsla(${particle.hue + 32}, 82%, 62%, ${particle.alpha * 0.42})`)
      gradient.addColorStop(1, 'hsla(0, 0%, 0%, 0)')

      ctx.fillStyle = gradient
      createHexagonPath(ctx, size)
      ctx.fill()
      ctx.restore()
    }

    ctx.restore()
    frameId = window.requestAnimationFrame(render)
  }

  frameId = window.requestAnimationFrame(render)

  function teardown() {
    running = false
    if (frameId != null) {
      window.cancelAnimationFrame(frameId)
      frameId = null
    }
  }

  window.addEventListener('resize', resize, { passive: true })
  resize()

  return () => {
    try {
      window.removeEventListener('resize', resize)
    } catch {}
    teardown()
  }
}

export default attachLensFlare
