import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Download } from "lucide-react";
import { useState } from "react";

interface Clip {
  id: string;
  title: string;
  duration: string;
}

interface DownloadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clips: Clip[];
  onDownload: (clipIds: string[]) => void;
}

export function DownloadModal({ open, onOpenChange, clips, onDownload }: DownloadModalProps) {
  const [selectedClips, setSelectedClips] = useState<Set<string>>(new Set(clips.map(c => c.id)));

  const toggleClip = (clipId: string) => {
    const newSelection = new Set(selectedClips);
    if (newSelection.has(clipId)) {
      newSelection.delete(clipId);
    } else {
      newSelection.add(clipId);
    }
    setSelectedClips(newSelection);
  };

  const toggleAll = () => {
    if (selectedClips.size === clips.length) {
      setSelectedClips(new Set());
    } else {
      setSelectedClips(new Set(clips.map(c => c.id)));
    }
  };

  const handleDownload = () => {
    onDownload(Array.from(selectedClips));
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="modal-download">
        <DialogHeader>
          <DialogTitle>Baixar Cortes</DialogTitle>
          <DialogDescription>
            Selecione os cortes que deseja baixar
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 max-h-60 overflow-y-auto">
          <div className="flex items-center gap-2 pb-2 border-b border-border">
            <Checkbox
              checked={selectedClips.size === clips.length}
              onCheckedChange={toggleAll}
              data-testid="checkbox-select-all"
            />
            <span className="text-sm font-medium">Selecionar todos</span>
          </div>
          {clips.map((clip) => (
            <div key={clip.id} className="flex items-center gap-2 hover-elevate p-2 rounded-md">
              <Checkbox
                checked={selectedClips.has(clip.id)}
                onCheckedChange={() => toggleClip(clip.id)}
                data-testid={`checkbox-clip-${clip.id}`}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate">{clip.title}</p>
                <p className="text-xs text-muted-foreground font-mono">{clip.duration}</p>
              </div>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button
            onClick={handleDownload}
            disabled={selectedClips.size === 0}
            className="w-full"
            data-testid="button-confirm-download"
          >
            <Download className="h-4 w-4 mr-2" />
            Baixar {selectedClips.size} {selectedClips.size === 1 ? 'Corte' : 'Cortes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
