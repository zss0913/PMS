'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

// 科技感粒子背景组件 - 更简洁的科技感效果
function TechBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const mouseRef = useRef({ x: 0, y: 0, active: false })
  const particlesRef = useRef<Array<{
    x: number
    y: number
    vx: number
    vy: number
    size: number
    opacity: number
    pulse: number
  }>>([])
  const frameRef = useRef(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const resizeCanvas = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)

    // 初始化粒子 - 减少数量，更简洁
    const particleCount = 60
    particlesRef.current = Array.from({ length: particleCount }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      size: Math.random() * 1.5 + 0.5,
      opacity: Math.random() * 0.4 + 0.2,
      pulse: Math.random() * Math.PI * 2,
    }))

    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY, active: true }
    }
    const handleMouseLeave = () => {
      mouseRef.current.active = false
    }
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseleave', handleMouseLeave)

    let animationId: number
    const animate = () => {
      frameRef.current++
      
      // 使用半透明填充实现拖尾效果
      ctx.fillStyle = 'rgba(15, 23, 42, 0.15)'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      const particles = particlesRef.current
      const mouse = mouseRef.current

      particles.forEach((particle, i) => {
        // 脉冲效果
        particle.pulse += 0.02
        const pulseFactor = Math.sin(particle.pulse) * 0.3 + 1
        
        // 鼠标影响 - 更柔和的吸引效果
        if (mouse.active) {
          const dx = mouse.x - particle.x
          const dy = mouse.y - particle.y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < 300 && dist > 50) {
            const force = (300 - dist) / 300 * 0.02
            particle.vx += dx * force
            particle.vy += dy * force
          }
        }

        // 速度衰减
        particle.vx *= 0.98
        particle.vy *= 0.98

        // 更新位置
        particle.x += particle.vx
        particle.y += particle.vy

        // 边界循环
        if (particle.x < 0) particle.x = canvas.width
        if (particle.x > canvas.width) particle.x = 0
        if (particle.y < 0) particle.y = canvas.height
        if (particle.y > canvas.height) particle.y = 0

        // 绘制粒子 - 带光晕效果
        const gradient = ctx.createRadialGradient(
          particle.x, particle.y, 0,
          particle.x, particle.y, particle.size * 3 * pulseFactor
        )
        gradient.addColorStop(0, `rgba(59, 130, 246, ${particle.opacity})`)
        gradient.addColorStop(0.5, `rgba(6, 182, 212, ${particle.opacity * 0.5})`)
        gradient.addColorStop(1, 'rgba(59, 130, 246, 0)')
        
        ctx.beginPath()
        ctx.arc(particle.x, particle.y, particle.size * 3 * pulseFactor, 0, Math.PI * 2)
        ctx.fillStyle = gradient
        ctx.fill()

        // 核心亮点
        ctx.beginPath()
        ctx.arc(particle.x, particle.y, particle.size * 0.5, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(147, 197, 253, ${particle.opacity * 1.5})`
        ctx.fill()

        // 只连接最近的2-3个粒子，避免混乱
        let connections = 0
        for (let j = i + 1; j < particles.length && connections < 2; j++) {
          const other = particles[j]
          const lineDx = particle.x - other.x
          const lineDy = particle.y - other.y
          const lineDist = Math.sqrt(lineDx * lineDx + lineDy * lineDy)
          if (lineDist < 120) {
            connections++
            const alpha = 0.2 * (1 - lineDist / 120)
            ctx.beginPath()
            ctx.moveTo(particle.x, particle.y)
            ctx.lineTo(other.x, other.y)
            ctx.strokeStyle = `rgba(59, 130, 246, ${alpha})`
            ctx.lineWidth = 0.5
            ctx.stroke()
          }
        }
      })

      // 偶尔绘制从粒子到鼠标的连线（不显示鼠标圈）
      if (mouse.active && frameRef.current % 5 === 0) {
        let mouseConnections = 0
        particles.forEach((particle) => {
          if (mouseConnections >= 3) return
          const dx = mouse.x - particle.x
          const dy = mouse.y - particle.y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < 200) {
            mouseConnections++
            ctx.beginPath()
            ctx.moveTo(particle.x, particle.y)
            ctx.lineTo(mouse.x, mouse.y)
            ctx.strokeStyle = 'rgba(6, 182, 212, 0.15)'
            ctx.lineWidth = 0.8
            ctx.stroke()
          }
        })
      }

      animationId = requestAnimationFrame(animate)
    }

    animate()

    return () => {
      window.removeEventListener('resize', resizeCanvas)
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseleave', handleMouseLeave)
      cancelAnimationFrame(animationId)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ background: 'linear-gradient(145deg, #0a0f1c 0%, #111827 50%, #0a0f1c 100%)' }}
    />
  )
}

// Flower Spinner Icon - 来自 epic-spinners
function FlowerSpinnerIcon() {
  return (
    <div className="relative w-12 h-12 flex items-center justify-center">
      <style jsx>{`
        .flower-spinner {
          height: 48px;
          width: 48px;
          display: flex;
          flex-direction: row;
          align-items: center;
          justify-content: center;
        }
        .flower-spinner .dots-container {
          height: calc(48px / 7);
          width: calc(48px / 7);
        }
        .flower-spinner .smaller-dot {
          background: #3b82f6;
          height: 100%;
          width: 100%;
          border-radius: 50%;
          animation: flower-spinner-smaller-dot-animation 2.5s 0s infinite both;
        }
        .flower-spinner .bigger-dot {
          background: #3b82f6;
          height: 100%;
          width: 100%;
          padding: 10%;
          border-radius: 50%;
          animation: flower-spinner-bigger-dot-animation 2.5s 0s infinite both;
        }
        @keyframes flower-spinner-bigger-dot-animation {
          0% {
            box-shadow: #3b82f6 0px 0px 0px, #3b82f6 0px 0px 0px, #3b82f6 0px 0px 0px, #3b82f6 0px 0px 0px,
              #3b82f6 0px 0px 0px, #3b82f6 0px 0px 0px, #3b82f6 0px 0px 0px, #3b82f6 0px 0px 0px;
          }
          25%, 75% {
            box-shadow: #3b82f6 18px 0px 0px, #3b82f6 -18px 0px 0px, #3b82f6 0px 18px 0px, #3b82f6 0px -18px 0px,
              #3b82f6 13px -13px 0px, #3b82f6 13px 13px 0px, #3b82f6 -13px -13px 0px, #3b82f6 -13px 13px 0px;
          }
          50% {
            transform: rotate(180deg);
          }
          100% {
            transform: rotate(360deg);
            box-shadow: #3b82f6 0px 0px 0px, #3b82f6 0px 0px 0px, #3b82f6 0px 0px 0px, #3b82f6 0px 0px 0px,
              #3b82f6 0px 0px 0px, #3b82f6 0px 0px 0px, #3b82f6 0px 0px 0px, #3b82f6 0px 0px 0px;
          }
        }
        @keyframes flower-spinner-smaller-dot-animation {
          0% {
            box-shadow: #06b6d4 0px 0px 0px, #06b6d4 0px 0px 0px, #06b6d4 0px 0px 0px, #06b6d4 0px 0px 0px,
              #06b6d4 0px 0px 0px, #06b6d4 0px 0px 0px, #06b6d4 0px 0px 0px, #06b6d4 0px 0px 0px;
          }
          25%, 75% {
            box-shadow: #06b6d4 10px 0px 0px, #06b6d4 -10px 0px 0px, #06b6d4 0px 10px 0px, #06b6d4 0px -10px 0px,
              #06b6d4 7px -7px 0px, #06b6d4 7px 7px 0px, #06b6d4 -7px -7px 0px, #06b6d4 -7px 7px 0px;
          }
          100% {
            box-shadow: #06b6d4 0px 0px 0px, #06b6d4 0px 0px 0px, #06b6d4 0px 0px 0px, #06b6d4 0px 0px 0px,
              #06b6d4 0px 0px 0px, #06b6d4 0px 0px 0px, #06b6d4 0px 0px 0px, #06b6d4 0px 0px 0px;
          }
        }
      `}</style>
      <div className="flower-spinner">
        <div className="dots-container">
          <div className="bigger-dot">
            <div className="smaller-dot"></div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  const router = useRouter()
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, password }),
        credentials: 'include',
      })
      const data = await res.json()
      if (!data.success) {
        setError(data.message || '登录失败')
        return
      }
      router.push('/')
      router.refresh()
    } catch {
      setError('网络错误')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative">
      {/* 科技感背景 */}
      <TechBackground />

      <div className="relative z-10 w-full max-w-md p-8">
        {/* Logo和标题 */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <FlowerSpinnerIcon />
          <span className="text-2xl font-bold text-white tracking-wide">商业地产-物业管理系统</span>
        </div>

        {/* 登录表单 */}
        <div className="bg-slate-800/60 backdrop-blur-md rounded-xl border border-slate-700/50 p-8 shadow-2xl">
          <h1 className="text-xl font-semibold text-white mb-6">账号登录</h1>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">手机号</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="请输入手机号"
                className="w-full px-4 py-2.5 rounded-lg bg-slate-700/50 border border-slate-600 text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">密码</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="请输入密码"
                className="w-full px-4 py-2.5 rounded-lg bg-slate-700/50 border border-slate-600 text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                required
              />
            </div>
            <div className="flex items-center">
              <input
                type="checkbox"
                id="remember"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="rounded border-slate-600 bg-slate-700 text-blue-500"
              />
              <label htmlFor="remember" className="ml-2 text-sm text-slate-400">记住密码</label>
            </div>
            {error && (
              <div className="text-red-400 text-sm">{error}</div>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-medium rounded-lg transition disabled:opacity-50 shadow-lg shadow-blue-600/20"
            >
              {loading ? '登录中...' : '登录'}
            </button>
          </form>
          <p className="mt-6 text-xs text-slate-500 text-center">
            测试账号：超级管理员 13800138000 / 物业管理员 13800138002，密码均为 123456
          </p>
        </div>
      </div>
    </div>
  )
}
