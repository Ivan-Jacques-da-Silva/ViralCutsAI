
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { useState, useRef, useEffect } from "react";
import { Play, Pause, RotateCcw } from "lucide-react";
import type { Video, VideoCut } from "@shared/schema";

interface VideoPreviewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  video: Video;
  cut: VideoCut;
  onUpdateCut: (cutId: string, startTime: number, endTime: number) => void;
}

export default function VideoPreview({ open, onOpenChange, video, cut, onUpdateCut }: VideoPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [startTime, setStartTime] = useState(cut.startTime);
  const [endTime, setEndTime] = useState(cut.endTime);
  const [isVideoReady, setIsVideoReady] = useState(false);

  useEffect(() => {
    setStartTime(cut.startTime);
    setEndTime(cut.endTime);
  }, [cut.startTime, cut.endTime]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleLoadedMetadata = () => {
      setDuration(video.duration);
      setIsVideoReady(true);
      if (startTime >= 0 && startTime < video.duration) {
        video.currentTime = startTime;
        setCurrentTime(startTime);
      }
    };

    const handleTimeUpdate = () => {
      const newTime = video.currentTime;
      setCurrentTime(newTime);
      if (newTime >= endTime && isPlaying) {
        video.pause();
        setIsPlaying(false);
      }
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => setIsPlaying(false);

    video.addEventListener("loadedmetadata", handleLoadedMetadata);
    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("play", handlePlay);
    video.addEventListener("pause", handlePause);
    video.addEventListener("ended", handleEnded);

    // Reset quando o diálogo abre
    if (open && video.readyState >= 1) {
      handleLoadedMetadata();
    }

    return () => {
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("play", handlePlay);
      video.removeEventListener("pause", handlePause);
      video.removeEventListener("ended", handleEnded);
    };
  }, [startTime, endTime, isPlaying, open]);

  const togglePlayPause = async () => {
    const video = videoRef.current;
    if (!video || !isVideoReady) return;

    try {
      if (isPlaying) {
        video.pause();
      } else {
        if (video.currentTime >= endTime || video.currentTime < startTime) {
          video.currentTime = startTime;
        }
        await video.play();
      }
    } catch (error) {
      console.error("Erro ao reproduzir vídeo:", error);
      setIsPlaying(false);
    }
  };

  const resetToStart = () => {
    const video = videoRef.current;
    if (!video || !isVideoReady) return;
    video.pause();
    video.currentTime = startTime;
    setCurrentTime(startTime);
  };

  const formatTime = (seconds: number) => {
    if (!isFinite(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleStartTimeChange = (value: number[]) => {
    if (!isVideoReady || !duration) return;
    const newStart = Math.max(0, Math.min(value[0], endTime - 1));
    setStartTime(newStart);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = newStart;
      setCurrentTime(newStart);
      setIsPlaying(false);
    }
  };

  const handleEndTimeChange = (value: number[]) => {
    if (!isVideoReady || !duration) return;
    const newEnd = Math.max(startTime + 1, Math.min(value[0], duration));
    setEndTime(newEnd);
  };

  const handleSave = () => {
    onUpdateCut(cut.id, startTime, endTime);
    onOpenChange(false);
  };

  const previewSegment = async () => {
    const video = videoRef.current;
    if (!video || !isVideoReady) return;
    
    try {
      video.currentTime = startTime;
      setCurrentTime(startTime);
      await video.play();
    } catch (error) {
      console.error("Erro ao pré-visualizar segmento:", error);
    }
  };

  const handleDialogChange = (newOpen: boolean) => {
    if (!newOpen) {
      // Pausa o vídeo antes de fechar
      const video = videoRef.current;
      if (video) {
        video.pause();
        setIsPlaying(false);
      }
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Ajustar Corte - {video.title}</DialogTitle>
          <DialogDescription>
            Visualize o vídeo e ajuste os tempos de início e fim do corte
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="relative bg-black rounded-lg overflow-hidden">
            <video
              ref={videoRef}
              src={`/api/videos/${video.id}/stream`}
              className="w-full"
              data-testid="video-preview-player"
              preload="metadata"
            />
            
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
              <div className="flex items-center gap-3">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={togglePlayPause}
                  className="text-white hover:bg-white/20"
                  data-testid="button-play-pause"
                  disabled={!isVideoReady}
                >
                  {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                </Button>
                
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={resetToStart}
                  className="text-white hover:bg-white/20"
                  data-testid="button-reset"
                  disabled={!isVideoReady}
                >
                  <RotateCcw className="h-5 w-5" />
                </Button>

                <div className="flex-1 flex items-center gap-2">
                  <span className="text-white text-sm font-mono min-w-[40px]">
                    {formatTime(currentTime)}
                  </span>
                  <div className="flex-1 h-1 bg-white/30 rounded-full relative">
                    <div 
                      className="absolute h-full bg-primary rounded-full transition-all"
                      style={{ width: duration > 0 ? `${(currentTime / duration) * 100}%` : '0%' }}
                    />
                    <div 
                      className="absolute h-full bg-yellow-500/50"
                      style={{ 
                        left: duration > 0 ? `${(startTime / duration) * 100}%` : '0%',
                        width: duration > 0 ? `${((endTime - startTime) / duration) * 100}%` : '0%'
                      }}
                    />
                  </div>
                  <span className="text-white text-sm font-mono min-w-[40px]">
                    {formatTime(duration)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Início do Corte</Label>
                <span className="text-sm font-mono text-muted-foreground">
                  {formatTime(startTime)}
                </span>
              </div>
              <Slider
                value={[startTime]}
                onValueChange={handleStartTimeChange}
                max={duration || 100}
                min={0}
                step={0.1}
                className="w-full"
                data-testid="slider-start-time"
                disabled={!isVideoReady}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Fim do Corte</Label>
                <span className="text-sm font-mono text-muted-foreground">
                  {formatTime(endTime)}
                </span>
              </div>
              <Slider
                value={[endTime]}
                onValueChange={handleEndTimeChange}
                max={duration || 100}
                min={0}
                step={0.1}
                className="w-full"
                data-testid="slider-end-time"
                disabled={!isVideoReady}
              />
            </div>

            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <span className="text-sm text-muted-foreground">Duração do corte:</span>
              <span className="text-sm font-semibold">
                {formatTime(endTime - startTime)} ({Math.floor((endTime - startTime) / 60)} min)
              </span>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={previewSegment}
              variant="outline"
              className="flex-1"
              data-testid="button-preview-segment"
              disabled={!isVideoReady}
            >
              <Play className="h-4 w-4 mr-2" />
              Pré-visualizar Segmento
            </Button>
            <Button
              onClick={handleSave}
              className="flex-1"
              data-testid="button-save-cut"
            >
              Salvar Alterações
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
