import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Loader2, Sparkles } from "lucide-react";
import { SiTiktok, SiYoutube, SiInstagram, SiFacebook } from "react-icons/si";
import type { PublicationMetadata, SocialAccount } from "@shared/schema";

interface PublicationModalProps {
  videoId: string;
  videoTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PublicationModal({ videoId, videoTitle, open, onOpenChange }: PublicationModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [hashtags, setHashtags] = useState("");
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [useAISuggestions, setUseAISuggestions] = useState(false);
  const { toast } = useToast();

  // Get existing metadata
  const { data: metadata, isLoading: isLoadingMetadata } = useQuery<PublicationMetadata | null>({
    queryKey: ["/api/videos", videoId, "metadata"],
    enabled: open,
  });

  // Get social accounts
  const { data: accounts = [] } = useQuery<SocialAccount[]>({
    queryKey: ["/api/social-accounts"],
    enabled: open,
  });

  // Generate suggestions mutation
  const generateMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/videos/${videoId}/generate-suggestions`, {});
      return await response.json();
    },
    onSuccess: (data: PublicationMetadata) => {
      queryClient.invalidateQueries({ queryKey: ["/api/videos", videoId, "metadata"] });
      setTitle(data.customTitle || data.aiSuggestedTitle || "");
      setDescription(data.customDescription || data.aiSuggestedDescription || "");
      setHashtags(data.customHashtags || data.aiSuggestedHashtags || "");
      setUseAISuggestions(true);
      toast({
        title: "Sugestões geradas!",
        description: "A IA criou título, descrição e hashtags para você",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Publish mutation
  const publishMutation = useMutation({
    mutationFn: async () => {
      // Publish with custom metadata
      const response = await apiRequest("POST", `/api/videos/${videoId}/publish`, {
        platforms: selectedPlatforms,
        title,
        description,
        hashtags,
      });
      return await response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/videos", videoId, "publications"] });
      toast({
        title: "Publicação iniciada!",
        description: data.message,
      });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao publicar",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Load existing metadata when dialog opens
  useEffect(() => {
    if (open && metadata) {
      setTitle(metadata.customTitle || metadata.aiSuggestedTitle || videoTitle || "");
      setDescription(metadata.customDescription || metadata.aiSuggestedDescription || "");
      setHashtags(metadata.customHashtags || metadata.aiSuggestedHashtags || "");
      setUseAISuggestions(!!(metadata.aiSuggestedTitle));
    } else if (open && !metadata) {
      setTitle(videoTitle || "");
      setDescription("");
      setHashtags("");
      setUseAISuggestions(false);
    }
  }, [open, metadata, videoTitle]);

  const handlePublish = () => {
    if (!title.trim()) {
      toast({
        title: "Erro",
        description: "Digite um título para a publicação",
        variant: "destructive",
      });
      return;
    }

    if (selectedPlatforms.length === 0) {
      toast({
        title: "Erro",
        description: "Selecione pelo menos uma plataforma",
        variant: "destructive",
      });
      return;
    }

    publishMutation.mutate();
  };

  const platformIcons: Record<string, any> = {
    tiktok: SiTiktok,
    youtube: SiYoutube,
    instagram: SiInstagram,
    facebook: SiFacebook,
  };

  const platformLabels: Record<string, string> = {
    tiktok: "TikTok",
    youtube: "YouTube Shorts",
    instagram: "Instagram Reels",
    facebook: "Facebook",
  };

  const availablePlatforms = ["tiktok", "youtube", "instagram", "facebook"];
  const connectedPlatforms = accounts.map(acc => acc.platform);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Publicar Vídeo nas Redes Sociais</DialogTitle>
          <DialogDescription>
            Configure o conteúdo e escolha onde publicar
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* AI Suggestions Button */}
          <div className="flex justify-end">
            <Button
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending}
              variant="outline"
              size="sm"
              data-testid="button-generate-suggestions"
            >
              {generateMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Gerando...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Gerar com IA
                </>
              )}
            </Button>
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Título *</Label>
            <Input
              id="title"
              data-testid="input-title"
              placeholder="Título chamativo para o vídeo"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={100}
            />
            <p className="text-xs text-muted-foreground">
              {title.length}/100 caracteres
            </p>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              data-testid="textarea-description"
              placeholder="Descrição do vídeo..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              maxLength={300}
            />
            <p className="text-xs text-muted-foreground">
              {description.length}/300 caracteres
            </p>
          </div>

          {/* Hashtags */}
          <div className="space-y-2">
            <Label htmlFor="hashtags">Hashtags</Label>
            <Input
              id="hashtags"
              data-testid="input-hashtags"
              placeholder="#viral #fyp #trending"
              value={hashtags}
              onChange={(e) => setHashtags(e.target.value)}
            />
          </div>

          {/* Platform Selection */}
          <div className="space-y-3">
            <Label>Selecione as Plataformas *</Label>
            <div className="grid grid-cols-2 gap-3">
              {availablePlatforms.map((platform) => {
                const Icon = platformIcons[platform];
                const isConnected = connectedPlatforms.includes(platform);
                const isSelected = selectedPlatforms.includes(platform);

                return (
                  <div
                    key={platform}
                    className={`flex items-center space-x-2 p-3 rounded-md border ${
                      !isConnected ? "opacity-50 bg-muted" : ""
                    }`}
                  >
                    <Checkbox
                      id={`platform-${platform}`}
                      data-testid={`checkbox-${platform}`}
                      checked={isSelected}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedPlatforms([...selectedPlatforms, platform]);
                        } else {
                          setSelectedPlatforms(selectedPlatforms.filter(p => p !== platform));
                        }
                      }}
                      disabled={!isConnected}
                    />
                    <label
                      htmlFor={`platform-${platform}`}
                      className="flex items-center gap-2 text-sm font-medium cursor-pointer flex-1"
                    >
                      <Icon className="h-4 w-4" />
                      {platformLabels[platform]}
                      {!isConnected && (
                        <span className="text-xs text-muted-foreground">(não conectada)</span>
                      )}
                    </label>
                  </div>
                );
              })}
            </div>
            {connectedPlatforms.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Nenhuma conta conectada. Vá para Configurações para conectar suas contas.
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel">
            Cancelar
          </Button>
          <Button
            onClick={handlePublish}
            disabled={publishMutation.isPending || selectedPlatforms.length === 0}
            data-testid="button-publish"
          >
            {publishMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Publicando...
              </>
            ) : (
              `Publicar em ${selectedPlatforms.length} plataforma(s)`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
