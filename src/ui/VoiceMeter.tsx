import { useEffect, useRef } from 'react'
import { levelToBar } from './meterScale.ts'

const BAR_WIDTH = 3
const BAR_GAP = 3
const STEP = BAR_WIDTH + BAR_GAP
// Her bu kadar sürede sağdan yeni bir çizgi girer.
const STEP_MS = 60

interface VoiceMeterProps {
  /** Son okumadan bu yana ulaşılan en yüksek ses seviyesini verip sıfırlar. */
  readLevel(): number
}

/**
 * Mikrofon açıkken sesi, sağdan sola akan dikey çizgilerle gösterir. Ses
 * yokken çizgiler nokta kadar kısadır; ses geldikçe şiddetine göre yukarı ve
 * aşağı uzar. Her ekran karesinde tuvale çizilir; React yeniden çizilmez.
 */
export function VoiceMeter({ readLevel }: VoiceMeterProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return

    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches
    let bars: number[] = []
    let lastStep = performance.now()
    let frame = 0

    const draw = (now: number) => {
      const { width, height } = fitToDevicePixels(canvas, context)
      const capacity = Math.ceil(width / STEP) + 1
      // Animasyon ilk açıldığında çizgi dizisi noktalarla dolu başlar.
      if (bars.length === 0) bars = new Array<number>(capacity).fill(0)

      while (now - lastStep >= STEP_MS) {
        bars.push(levelToBar(readLevel()))
        lastStep += STEP_MS
      }
      if (bars.length > capacity) bars = bars.slice(-capacity)

      // Çizgiler iki adım arasında da kayar; böylece akış kesintisiz görünür.
      const offset = reducedMotion ? 0 : ((now - lastStep) / STEP_MS) * STEP
      context.clearRect(0, 0, width, height)
      context.fillStyle = getComputedStyle(canvas).color
      bars.forEach((bar, index) => {
        const x = width - BAR_WIDTH - (bars.length - 1 - index) * STEP - offset
        const barHeight = BAR_WIDTH + bar * (height - BAR_WIDTH)
        context.beginPath()
        context.roundRect(x, (height - barHeight) / 2, BAR_WIDTH, barHeight, BAR_WIDTH / 2)
        context.fill()
      })

      frame = requestAnimationFrame(draw)
    }

    frame = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(frame)
  }, [readLevel])

  return <canvas ref={canvasRef} className="meter" aria-hidden="true" />
}

/** Tuvali ekranın piksel yoğunluğuna göre boyutlar; çizgiler bulanık görünmez. */
function fitToDevicePixels(canvas: HTMLCanvasElement, context: CanvasRenderingContext2D) {
  const { width, height } = canvas.getBoundingClientRect()
  const ratio = window.devicePixelRatio || 1
  const pixelWidth = Math.round(width * ratio)
  const pixelHeight = Math.round(height * ratio)
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth
    canvas.height = pixelHeight
  }
  context.setTransform(ratio, 0, 0, ratio, 0, 0)
  return { width, height }
}
