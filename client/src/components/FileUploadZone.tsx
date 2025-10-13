import { Upload, Video } from "lucide-react";
import { useState } from "react";

interface FileUploadZoneProps {
  onFileSelect: (file: File) => void;
}

export function FileUploadZone({ onFileSelect }: FileUploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragging(true);
    } else if (e.type === "dragleave") {
      setIsDragging(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    const videoFile = files.find(file => file.type.startsWith('video/'));
    
    if (videoFile) {
      onFileSelect(videoFile);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files[0]) {
      onFileSelect(files[0]);
    }
  };

  return (
    <div
      className={`
        relative h-48 rounded-lg border-2 border-dashed transition-colors
        ${isDragging ? 'border-primary bg-primary/5' : 'border-border'}
      `}
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
      data-testid="dropzone-upload"
    >
      <input
        type="file"
        accept="video/*"
        onChange={handleFileInput}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        data-testid="input-file"
      />
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 pointer-events-none">
        {isDragging ? (
          <Video className="h-12 w-12 text-primary" />
        ) : (
          <Upload className="h-12 w-12 text-muted-foreground" />
        )}
        <p className="text-sm font-medium text-foreground">
          {isDragging ? 'Solte o vídeo aqui' : 'Arraste um vídeo ou clique para selecionar'}
        </p>
        <p className="text-xs text-muted-foreground">
          MP4, MOV, AVI (máx. 2GB)
        </p>
      </div>
    </div>
  );
}
