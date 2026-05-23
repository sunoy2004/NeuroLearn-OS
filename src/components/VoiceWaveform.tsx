import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface VoiceWaveformProps {
  isListening: boolean;
  className?: string;
  height?: number;
  barCount?: number;
}

export function VoiceWaveform({
  isListening,
  className = "",
  height = 60,
  barCount = 32,
}: VoiceWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = canvas.offsetWidth * 2;
    canvas.height = height * 2;

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const barWidth = canvas.width / barCount;
      const centerY = canvas.height / 2;

      for (let i = 0; i < barCount; i++) {
        const x = barWidth * i + barWidth / 4;

        let normalizedHeight: number;
        if (isListening) {
          const time = Date.now() / 1000;
          const baseHeight = canvas.height * 0.3;
          const variance = canvas.height * 0.4;
          const wave = Math.sin(i * 0.3 + time * 3) * 0.5 + 0.5;
          const noise = Math.random() * 0.2;
          normalizedHeight = baseHeight + variance * (wave + noise);
        } else {
          normalizedHeight = canvas.height * 0.08;
        }

        const gradient = ctx.createLinearGradient(x, centerY - normalizedHeight / 2, x, centerY + normalizedHeight / 2);

        if (isListening) {
          gradient.addColorStop(0, "rgba(34, 211, 238, 0.8)");
          gradient.addColorStop(0.5, "rgba(34, 211, 238, 1)");
          gradient.addColorStop(1, "rgba(34, 211, 238, 0.8)");
        } else {
          gradient.addColorStop(0, "rgba(100, 100, 100, 0.3)");
          gradient.addColorStop(0.5, "rgba(100, 100, 100, 0.5)");
          gradient.addColorStop(1, "rgba(100, 100, 100, 0.3)");
        }

        ctx.fillStyle = gradient;
        ctx.beginPath();
        const radius = barWidth / 4;
        ctx.roundRect(x, centerY - normalizedHeight / 2, barWidth / 2, normalizedHeight, radius);
        ctx.fill();
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isListening, barCount, height]);

  return (
    <div className={cn("relative w-full overflow-hidden rounded-lg bg-muted/30 border border-border/30", className)}>
      <canvas
        ref={canvasRef}
        className="w-full"
        style={{ height: `${height}px` }}
      />
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <span
          className={cn(
            "text-xs font-medium transition-opacity",
            isListening ? "text-cyan-600" : "text-muted-foreground"
          )}
        >
          {isListening ? "🎤 Listening..." : "Voice Waveform"}
        </span>
      </div>
    </div>
  );
}
