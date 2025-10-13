import { Progress } from "@/components/ui/progress";
import { Loader2 } from "lucide-react";

interface ProcessingStatusProps {
  fileName: string;
  progress: number;
  status: 'uploading' | 'analyzing' | 'processing' | 'complete';
}

export function ProcessingStatus({ fileName, progress, status }: ProcessingStatusProps) {
  const getStatusText = () => {
    switch (status) {
      case 'uploading': return 'Enviando vídeo...';
      case 'analyzing': return 'Analisando com IA...';
      case 'processing': return 'Gerando cortes...';
      case 'complete': return 'Concluído!';
      default: return 'Processando...';
    }
  };

  return (
    <div className="space-y-3 p-4 bg-card rounded-lg border border-card-border" data-testid="status-processing">
      <div className="flex items-center gap-3">
        {status !== 'complete' && (
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate font-mono" data-testid="text-filename">
            {fileName}
          </p>
          <p className="text-xs text-muted-foreground" data-testid="text-status">
            {getStatusText()}
          </p>
        </div>
      </div>
      <div className="space-y-1">
        <Progress value={progress} className="h-1" />
        <p className="text-xs text-center text-muted-foreground" data-testid="text-progress">
          {progress}%
        </p>
      </div>
    </div>
  );
}
