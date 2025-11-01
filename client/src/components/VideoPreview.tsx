` tags.

<replit_final_file>
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useState, useRef, useEffect } from "react";
import { Play, Pause, RotateCcw, ChevronLeft, ChevronRight, Clock, Scissors } from "lucide-react";
import type { Video, VideoCut } from "@shared/schema";
import { Badge } from "@/components/ui/badge";

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
  const videoPath = `/api/videos/${video.id}/stream`;

  // Atualiza os tempos quando o cut mudar
  useEffect(() => {
    setStartTime(cut.startTime);
    setEndTime(cut.endTime);
  }, [cut.startTime, cut.endTime]);

  // Setup do vídeo e event listeners
  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    const handleLoadedMetadata = () => {
      setDuration(videoElement.duration);
      setIsVideoReady(true);
      if (startTime >= 0 && startTime < videoElement.duration) {
        videoElement.currentTime = startTime;
        setCurrentTime(startTime);
      }
    };

    const handleTimeUpdate = () => {
      if (!videoRef.current) return;
      const newTime = videoRef.current.currentTime;

      // Se passou do fim, volta para o início
      if (newTime > endTime) {
        videoRef.current.currentTime = startTime;
        setCurrentTime(startTime);
        if (isPlaying) {
          videoRef.current.pause();
          setIsPlaying(false);
        }
        return;
      }

      // Se está antes do início, vai para o início
      if (newTime < startTime) {
        videoRef.current.currentTime = startTime;
        setCurrentTime(startTime);
        return;
      }

      setCurrentTime(newTime);
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    videoElement.addEventListener("loadedmetadata", handleLoadedMetadata);
    videoElement.addEventListener("timeupdate", handleTimeUpdate);
    videoElement.addEventListener("play", handlePlay);
    videoElement.addEventListener("pause", handlePause);

    // Reset quando o diálogo abre
    if (open && videoElement.readyState >= 1) {
      handleLoadedMetadata();
    }

    return () => {
      videoElement.removeEventListener("loadedmetadata", handleLoadedMetadata);
      videoElement.removeEventListener("timeupdate", handleTimeUpdate);
      videoElement.removeEventListener("play", handlePlay);
      videoElement.removeEventListener("pause", handlePause);
    };
  }, [startTime, endTime, isPlaying, open]);

  const togglePlayPause = async () => {
    if (!videoRef.current || !isVideoReady) return;

    try {
      if (isPlaying) {
        videoRef.current.pause();
        setIsPlaying(false);
      } else {
        // Se está no fim ou fora do range, volta para o início
        if (currentTime >= endTime || currentTime < startTime) {
          videoRef.current.currentTime = startTime;
          setCurrentTime(startTime);
        }

        await videoRef.current.play();
        setIsPlaying(true);
      }
    } catch (error) {
      console.error('Erro ao reproduzir vídeo:', error);
      setIsPlaying(false);
    }
  };

  const resetToStart = () => {
    const videoElement = videoRef.current;
    if (!videoElement || !isVideoReady) return;
    videoElement.pause();
    videoElement.currentTime = startTime;
    setCurrentTime(startTime);
    setIsPlaying(false);
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

    // Atualiza o vídeo para o novo tempo
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
    const videoElement = videoRef.current;
    if (!videoElement || !isVideoReady) return;

    try {
      videoElement.currentTime = startTime;
      setCurrentTime(startTime);
      await videoElement.play();
      setIsPlaying(true);
    } catch (error) {
      console.error("Erro ao pré-visualizar segmento:", error);
    }
  };

  const handleDialogChange = (newOpen: boolean) => {
    if (!newOpen) {
      // Pausa o vídeo antes de fechar
      const videoElement = videoRef.current;
      if (videoElement) {
        videoElement.pause();
        setIsPlaying(false);
      }
    }
    onOpenChange(newOpen);
  };

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isVideoReady || !duration) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    const newTime = percentage * duration;
    
    if (videoRef.current) {
      videoRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scissors className="h-5 w-5 text-primary" />
            Ajustar Corte - {video.title}
          </DialogTitle>
          <DialogDescription>
            Use a timeline abaixo para posicionar e ajustar o momento do corte. O vídeo NÃO será cortado ainda.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="relative bg-black rounded-lg overflow-hidden">
            <video
              ref={videoRef}
              src={videoPath}
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
                  <div 
                    className="flex-1 h-2 bg-white/30 rounded-full relative cursor-pointer"
                    onClick={handleTimelineClick}
                    data-testid="timeline-scrubber"
                  >
                    <div 
                      className="absolute h-full bg-primary rounded-full transition-all"
                      style={{ width: duration > 0 ? `${(currentTime / duration) * 100}%` : '0%' }}
                    />
                    <div 
                      className="absolute h-full bg-green-500/40"
                      style={{ 
                        left: duration > 0 ? `${(startTime / duration) * 100}%` : '0%',
                        width: duration > 0 ? `${((endTime - startTime) / duration) * 100}%` : '0%'
                      }}
                    />
                    <div 
                      className="absolute top-1/2 -translate-y-1/2 w-1 h-4 bg-green-500 rounded-full"
                      style={{ left: duration > 0 ? `${(startTime / duration) * 100}%` : '0%' }}
                    />
                    <div 
                      className="absolute top-1/2 -translate-y-1/2 w-1 h-4 bg-red-500 rounded-full"
                      style={{ left: duration > 0 ? `${(endTime / duration) * 100}%` : '0%' }}
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
            <div className="p-4 bg-muted/30 rounded-lg border-2 border-dashed">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Scissors className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold">Posicionar Momento do Corte</h3>
                </div>
                <Badge variant="secondary" className="font-mono">
                  {formatTime(endTime - startTime)} ({Math.floor((endTime - startTime))}s)
                </Badge>
              </div>
              
              <p className="text-sm text-muted-foreground mb-4">
                Arraste os controles ou clique nos botões para ajustar onde o corte começa e termina. 
                Você pode reproduzir o segmento para ver como ficará.
              </p>

              <div className="space-y-6">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-green-500"></div>
                      <Label className="text-sm font-medium">Início do Corte</Label>
                    </div>
                    <span className="text-sm font-mono font-bold text-green-600 dark:text-green-400">
                      {formatTime(startTime)}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleStartTimeChange([Math.max(0, startTime - 5)])}
                      disabled={!isVideoReady || startTime <= 0}
                      data-testid="button-start-minus-5"
                    >
                      <ChevronLeft className="h-3 w-3" />
                      5s
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleStartTimeChange([Math.max(0, startTime - 1)])}
                      disabled={!isVideoReady || startTime <= 0}
                      data-testid="button-start-minus-1"
                    >
                      <ChevronLeft className="h-3 w-3" />
                      1s
                    </Button>
                    <Input
                      type="number"
                      value={Math.floor(startTime)}
                      onChange={(e) => handleStartTimeChange([parseInt(e.target.value) || 0])}
                      className="text-center font-mono flex-1"
                      min={0}
                      max={endTime - 1}
                      disabled={!isVideoReady}
                      data-testid="input-start-time"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleStartTimeChange([Math.min(endTime - 1, startTime + 1)])}
                      disabled={!isVideoReady || startTime >= endTime - 1}
                      data-testid="button-start-plus-1"
                    >
                      1s
                      <ChevronRight className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleStartTimeChange([Math.min(endTime - 1, startTime + 5)])}
                      disabled={!isVideoReady || startTime >= endTime - 1}
                      data-testid="button-start-plus-5"
                    >
                      5s
                      <ChevronRight className="h-3 w-3" />
                    </Button>
                  </div>
                  
                  <Slider
                    value={[startTime]}
                    onValueChange={handleStartTimeChange}
                    max={duration || 100}
                    min={0}
                    step={0.5}
                    className="w-full"
                    data-testid="slider-start-time"
                    disabled={!isVideoReady}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-red-500"></div>
                      <Label className="text-sm font-medium">Fim do Corte</Label>
                    </div>
                    <span className="text-sm font-mono font-bold text-red-600 dark:text-red-400">
                      {formatTime(endTime)}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEndTimeChange([Math.max(startTime + 1, endTime - 5)])}
                      disabled={!isVideoReady || endTime <= startTime + 1}
                      data-testid="button-end-minus-5"
                    >
                      <ChevronLeft className="h-3 w-3" />
                      5s
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEndTimeChange([Math.max(startTime + 1, endTime - 1)])}
                      disabled={!isVideoReady || endTime <= startTime + 1}
                      data-testid="button-end-minus-1"
                    >
                      <ChevronLeft className="h-3 w-3" />
                      1s
                    </Button>
                    <Input
                      type="number"
                      value={Math.floor(endTime)}
                      onChange={(e) => handleEndTimeChange([parseInt(e.target.value) || 0])}
                      className="text-center font-mono flex-1"
                      min={startTime + 1}
                      max={duration}
                      disabled={!isVideoReady}
                      data-testid="input-end-time"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEndTimeChange([Math.min(duration, endTime + 1)])}
                      disabled={!isVideoReady || endTime >= duration}
                      data-testid="button-end-plus-1"
                    >
                      1s
                      <ChevronRight className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEndTimeChange([Math.min(duration, endTime + 5)])}
                      disabled={!isVideoReady || endTime >= duration}
                      data-testid="button-end-plus-5"
                    >
                      5s
                      <ChevronRight className="h-3 w-3" />
                    </Button>
                  </div>
                  
                  <Slider
                    value={[endTime]}
                    onValueChange={handleEndTimeChange}
                    max={duration || 100}
                    min={0}
                    step={0.5}
                    className="w-full"
                    data-testid="slider-end-time"
                    disabled={!isVideoReady}
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 p-3 bg-primary/5 rounded-lg border border-primary/20">
              <Clock className="h-5 w-5 text-primary" />
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">Duração do Segmento</p>
                <p className="text-lg font-bold text-primary">
                  {formatTime(endTime - startTime)}
                </p>
              </div>
              <Button
                onClick={previewSegment}
                variant="default"
                size="sm"
                data-testid="button-preview-segment"
                disabled={!isVideoReady}
              >
                <Play className="h-4 w-4 mr-2" />
                Reproduzir Segmento
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-2 pt-4 border-t">
            <p className="text-sm text-muted-foreground text-center">
              Após ajustar, clique em "Salvar" para guardar as posições. 
              O vídeo só será cortado quando você clicar em "Processar Cortes" na tela principal.
            </p>
            <div className="flex gap-2">
              <Button
                onClick={() => onOpenChange(false)}
                variant="outline"
                className="flex-1"
                data-testid="button-cancel"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSave}
                className="flex-1"
                data-testid="button-save-cut"
              >
                <Scissors className="h-4 w-4 mr-2" />
                Salvar Posições
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}