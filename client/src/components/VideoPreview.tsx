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

  useEffect(() => {
    setStartTime(cut.startTime);
    setEndTime(cut.endTime);
  }, [cut.startTime, cut.endTime]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleLoadedMetadata = () => {
      setDuration(video.duration);
      video.currentTime = startTime;
    };

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      if (video.currentTime >= endTime) {
        video.pause();
        setIsPlaying(false);
      }
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    video.addEventListener("loadedmetadata", handleLoadedMetadata);
    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("play", handlePlay);
    video.addEventListener("pause", handlePause);

    return () => {
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("play", handlePlay);
      video.removeEventListener("pause", handlePause);
    };
  }, [startTime, endTime]);

  const togglePlayPause = () => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
    } else {
      if (video.currentTime >= endTime || video.currentTime < startTime) {
        video.currentTime = startTime;
      }
      video.play();
    }
  };

  const resetToStart = () => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = startTime;
    video.pause();
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleStartTimeChange = (value: number[]) => {
    const newStart = value[0];
    if (newStart < endTime) {
      setStartTime(newStart);
      if (videoRef.current) {
        videoRef.current.currentTime = newStart;
      }
    }
  };

  const handleEndTimeChange = (value: number[]) => {
    const newEnd = value[0];
    if (newEnd > startTime) {
      setEndTime(newEnd);
    }
  };

  const handleSave = () => {
    onUpdateCut(cut.id, startTime, endTime);
    onOpenChange(false);
  };

  const previewSegment = () => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = startTime;
    video.play();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
            />
            
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
              <div className="flex items-center gap-3">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={togglePlayPause}
                  className="text-white hover:bg-white/20"
                  data-testid="button-play-pause"
                >
                  {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                </Button>
                
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={resetToStart}
                  className="text-white hover:bg-white/20"
                  data-testid="button-reset"
                >
                  <RotateCcw className="h-5 w-5" />
                </Button>

                <div className="flex-1 flex items-center gap-2">
                  <span className="text-white text-sm font-mono">
                    {formatTime(currentTime)}
                  </span>
                  <div className="flex-1 h-1 bg-white/30 rounded-full relative">
                    <div 
                      className="absolute h-full bg-primary rounded-full"
                      style={{ width: `${(currentTime / duration) * 100}%` }}
                    />
                    <div 
                      className="absolute h-full bg-yellow-500/50"
                      style={{ 
                        left: `${(startTime / duration) * 100}%`,
                        width: `${((endTime - startTime) / duration) * 100}%`
                      }}
                    />
                  </div>
                  <span className="text-white text-sm font-mono">
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
                max={duration}
                step={0.1}
                className="w-full"
                data-testid="slider-start-time"
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
                max={duration}
                step={0.1}
                className="w-full"
                data-testid="slider-end-time"
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
