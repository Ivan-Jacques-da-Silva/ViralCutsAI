import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Video, Upload, Link as LinkIcon, Play, Loader2 } from "lucide-react";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Video as VideoType } from "@shared/schema";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function Home() {
  const [activeTab, setActiveTab] = useState<"upload" | "url">("upload");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [uploadTitle, setUploadTitle] = useState("");
  const [urlTitle, setUrlTitle] = useState("");
  const { toast } = useToast();

  const { data: videos, isLoading: isLoadingVideos } = useQuery<VideoType[]>({
    queryKey: ["/api/videos"],
  });

  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await fetch("/api/videos/upload", {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erro ao fazer upload");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/videos"] });
      setSelectedFile(null);
      setUploadTitle("");
      toast({
        title: "Sucesso!",
        description: "Vídeo enviado e analisado com sucesso",
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

  const urlMutation = useMutation({
    mutationFn: async (data: { url: string; title?: string }) => {
      const response = await apiRequest("POST", "/api/videos/url", data);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/videos"] });
      setVideoUrl("");
      setUrlTitle("");
      toast({
        title: "Sucesso!",
        description: "Vídeo baixado e analisado com sucesso",
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith("video/")) {
        toast({
          title: "Erro",
          description: "Por favor, selecione um arquivo de vídeo",
          variant: "destructive",
        });
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleUpload = () => {
    if (!selectedFile) {
      toast({
        title: "Erro",
        description: "Selecione um vídeo primeiro",
        variant: "destructive",
      });
      return;
    }

    const formData = new FormData();
    formData.append("video", selectedFile);
    if (uploadTitle) {
      formData.append("title", uploadTitle);
    }

    uploadMutation.mutate(formData);
  };

  const handleUrlSubmit = () => {
    if (!videoUrl) {
      toast({
        title: "Erro",
        description: "Digite uma URL válida",
        variant: "destructive",
      });
      return;
    }

    urlMutation.mutate({ url: videoUrl, title: urlTitle });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="bg-primary rounded-lg p-2">
              <Video className="h-6 w-6 text-primary-foreground" />
            </div>
            <h1 className="text-2xl font-bold">Análise de Vídeos com IA</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div>
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "upload" | "url")}>
              <TabsList className="grid w-full grid-cols-2" data-testid="tabs-navigation">
                <TabsTrigger value="upload" data-testid="tab-upload">
                  <Upload className="h-4 w-4 mr-2" />
                  Upload
                </TabsTrigger>
                <TabsTrigger value="url" data-testid="tab-url">
                  <LinkIcon className="h-4 w-4 mr-2" />
                  URL
                </TabsTrigger>
              </TabsList>

              <TabsContent value="upload" className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Enviar Vídeo</CardTitle>
                    <CardDescription>
                      Faça upload de um vídeo para análise com IA
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="upload-title">Título (opcional)</Label>
                      <Input
                        id="upload-title"
                        data-testid="input-upload-title"
                        placeholder="Nome do vídeo"
                        value={uploadTitle}
                        onChange={(e) => setUploadTitle(e.target.value)}
                        disabled={uploadMutation.isPending}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="video-file">Arquivo de Vídeo</Label>
                      <Input
                        id="video-file"
                        data-testid="input-video-file"
                        type="file"
                        accept="video/*"
                        onChange={handleFileChange}
                        disabled={uploadMutation.isPending}
                      />
                    </div>
                    {selectedFile && (
                      <p className="text-sm text-muted-foreground" data-testid="text-selected-file">
                        Arquivo selecionado: {selectedFile.name}
                      </p>
                    )}
                    <Button
                      onClick={handleUpload}
                      disabled={!selectedFile || uploadMutation.isPending}
                      className="w-full"
                      data-testid="button-upload"
                    >
                      {uploadMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Processando...
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4 mr-2" />
                          Enviar e Analisar
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="url" className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Vídeo por URL</CardTitle>
                    <CardDescription>
                      Cole a URL de um vídeo para baixar e analisar
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="url-title">Título (opcional)</Label>
                      <Input
                        id="url-title"
                        data-testid="input-url-title"
                        placeholder="Nome do vídeo"
                        value={urlTitle}
                        onChange={(e) => setUrlTitle(e.target.value)}
                        disabled={urlMutation.isPending}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="video-url">URL do Vídeo</Label>
                      <Input
                        id="video-url"
                        data-testid="input-video-url"
                        placeholder="https://example.com/video.mp4"
                        value={videoUrl}
                        onChange={(e) => setVideoUrl(e.target.value)}
                        disabled={urlMutation.isPending}
                      />
                    </div>
                    <Button
                      onClick={handleUrlSubmit}
                      disabled={!videoUrl || urlMutation.isPending}
                      className="w-full"
                      data-testid="button-url-submit"
                    >
                      {urlMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Processando...
                        </>
                      ) : (
                        <>
                          <LinkIcon className="h-4 w-4 mr-2" />
                          Baixar e Analisar
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          <div>
            <Card>
              <CardHeader>
                <CardTitle>Vídeos Analisados</CardTitle>
                <CardDescription>
                  Histórico de vídeos processados pela IA
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingVideos ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : videos && videos.length > 0 ? (
                  <div className="space-y-4">
                    {videos.map((video) => (
                      <Card key={video.id} className="hover-elevate" data-testid={`card-video-${video.id}`}>
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <CardTitle className="text-base" data-testid={`text-title-${video.id}`}>
                                {video.title || "Sem título"}
                              </CardTitle>
                              <CardDescription className="text-xs mt-1">
                                {video.uploadedAt && format(new Date(video.uploadedAt), "PPp", { locale: ptBR })}
                              </CardDescription>
                            </div>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => window.open(`/api/videos/${video.id}/stream`, "_blank")}
                              data-testid={`button-play-${video.id}`}
                            >
                              <Play className="h-4 w-4" />
                            </Button>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-muted-foreground" data-testid={`text-analysis-${video.id}`}>
                            {video.analysis || "Nenhuma análise disponível"}
                          </p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Video className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">
                      Nenhum vídeo analisado ainda
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
