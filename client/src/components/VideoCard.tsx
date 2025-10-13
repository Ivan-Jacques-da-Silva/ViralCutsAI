import { Download, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface VideoClip {
  id: string;
  thumbnailUrl: string;
  duration: string;
  startTime: string;
  endTime: string;
  title: string;
}

interface VideoCardProps {
  clip: VideoClip;
  onDownload: (id: string) => void;
  onPreview: (id: string) => void;
}

export function VideoCard({ clip, onDownload, onPreview }: VideoCardProps) {
  return (
    <Card className="overflow-hidden hover-elevate" data-testid={`card-clip-${clip.id}`}>
      <div className="relative aspect-video bg-muted">
        <img 
          src={clip.thumbnailUrl} 
          alt={clip.title}
          className="w-full h-full object-cover"
        />
        <div className="absolute top-2 right-2">
          <Badge variant="secondary" className="bg-black/80 text-white text-xs">
            {clip.duration}
          </Badge>
        </div>
        <button
          onClick={() => onPreview(clip.id)}
          className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 hover:opacity-100 transition-opacity"
          data-testid={`button-preview-${clip.id}`}
        >
          <div className="bg-white/90 rounded-full p-3">
            <Play className="h-6 w-6 text-black fill-black" />
          </div>
        </button>
      </div>
      <CardContent className="p-4 space-y-3">
        <div>
          <h3 className="font-medium text-sm line-clamp-1" data-testid={`text-title-${clip.id}`}>
            {clip.title}
          </h3>
          <p className="text-xs text-muted-foreground font-mono">
            {clip.startTime} - {clip.endTime}
          </p>
        </div>
        <Button 
          onClick={() => onDownload(clip.id)}
          className="w-full"
          size="sm"
          data-testid={`button-download-${clip.id}`}
        >
          <Download className="h-4 w-4 mr-2" />
          Baixar Corte
        </Button>
      </CardContent>
    </Card>
  );
}
