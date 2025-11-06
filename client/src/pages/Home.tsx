import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Video, Upload, Link as LinkIcon, Loader2, Scissors, Download, MonitorPlay, Smartphone, Users, Eye, Sparkles, TrendingUp, Zap } from "lucide-react";
import { Link } from "wouter";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Video as VideoType, VideoCut, ProcessedCut } from "@shared/schema";
import VideoPreview from "@/components/VideoPreview";

interface UploadResponse {
  video: VideoType;
  cuts: VideoCut[];
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<"upload" | "url">("upload");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [uploadTitle, setUploadTitle] = useState("");
  const [urlTitle, setUrlTitle] = useState("");
  const [currentVideo, setCurrentVideo] = useState<UploadResponse | null>(null);
  const [selectedCuts, setSelectedCuts] = useState<Set<string>>(new Set());
  const [selectedFormat, setSelectedFormat] = useState<"horizontal" | "vertical">("vertical");
  const [previewCut, setPreviewCut] = useState<VideoCut | null>(null);
  const { toast } = useToast();

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
    onSuccess: (data: UploadResponse) => {
      setCurrentVideo(data);
      setSelectedFile(null);
      setUploadTitle("");
      setSelectedCuts(new Set());
      toast({
        title: "Análise Completa!",
        description: `IA identificou ${data.cuts.length} momento${data.cuts.length !== 1 ? 's' : ''} com potencial viral. Clique para visualizar e ajustar!`,
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
    onSuccess: (data: UploadResponse) => {
      setCurrentVideo(data);
      setVideoUrl("");
      setUrlTitle("");
      setSelectedCuts(new Set());
      toast({
        title: "Análise Completa!",
        description: `IA identificou ${data.cuts.length} momento${data.cuts.length !== 1 ? 's' : ''} com potencial viral. Clique para visualizar e ajustar!`,
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

  const processMutation = useMutation({
    mutationFn: async ({ cutId, format }: { cutId: string; format: string }) => {
      const response = await apiRequest("POST", `/api/cuts/${cutId}/process`, { format });
      return await response.json();
    },
    onSuccess: (data: ProcessedCut) => {
      toast({
        title: "Sucesso!",
        description: "Corte processado com legendas!",
      });
      window.open(`/api/processed/${data.id}/download`, "_blank");
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateCutMutation = useMutation({
    mutationFn: async ({ cutId, startTime, endTime }: { cutId: string; startTime: number; endTime: number }) => {
      const response = await apiRequest("PUT", `/api/cuts/${cutId}`, { startTime, endTime });
      return await response.json();
    },
    onSuccess: (updatedCut: VideoCut) => {
      if (currentVideo) {
        const updatedCuts = currentVideo.cuts.map(c => 
          c.id === updatedCut.id ? updatedCut : c
        );
        setCurrentVideo({ ...currentVideo, cuts: updatedCuts });
      }
      toast({
        title: "Sucesso!",
        description: "Tempos do corte atualizados!",
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

  const toggleCutSelection = (cutId: string) => {
    const newSelected = new Set(selectedCuts);
    if (newSelected.has(cutId)) {
      newSelected.delete(cutId);
    } else {
      newSelected.add(cutId);
    }
    setSelectedCuts(newSelected);
  };

  const handleProcessCuts = () => {
    if (selectedCuts.size === 0) {
      toast({
        title: "Erro",
        description: "Selecione pelo menos um corte",
        variant: "destructive",
      });
      return;
    }

    selectedCuts.forEach((cutId) => {
      processMutation.mutate({ cutId, format: selectedFormat });
    });
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const isProcessing = uploadMutation.isPending || urlMutation.isPending || processMutation.isPending;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-3 justify-between">
            <div className="bg-primary rounded-lg p-2">
              <Scissors className="h-6 w-6 text-primary-foreground" />
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-bold flex items-center gap-2">
                Cortador de Vídeos para Reels
              </h1>
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <Sparkles className="h-3 w-3 text-primary" />
                IA identifica momentos virais e gera legendas automáticas
              </p>
            </div>
            <Link href="/accounts">
              <Button variant="outline" size="sm" data-testid="button-accounts">
                <Users className="h-4 w-4 mr-2" /> Contas
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "upload" | "url")}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="upload">
                  <Upload className="h-4 w-4 mr-2" />
                  Upload
                </TabsTrigger>
                <TabsTrigger value="url">
                  <LinkIcon className="h-4 w-4 mr-2" />
                  URL
                </TabsTrigger>
              </TabsList>

              <TabsContent value="upload" className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Enviar Vídeo</CardTitle>
                    <CardDescription>
                      Faça upload de um vídeo e a IA identificará os melhores cortes
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="upload-title">Título (opcional)</Label>
                      <Input
                        id="upload-title"
                        placeholder="Nome do vídeo"
                        value={uploadTitle}
                        onChange={(e) => setUploadTitle(e.target.value)}
                        disabled={isProcessing}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="video-file">Arquivo de Vídeo</Label>
                      <Input
                        id="video-file"
                        type="file"
                        accept="video/*"
                        onChange={handleFileChange}
                        disabled={isProcessing}
                      />
                    </div>
                    {selectedFile && (
                      <p className="text-sm text-muted-foreground">
                        Arquivo selecionado: {selectedFile.name}
                      </p>
                    )}
                    <Button
                      onClick={handleUpload}
                      disabled={!selectedFile || isProcessing}
                      className="w-full"
                    >
                      {uploadMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Analisando vídeo...
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
                      Cole a URL de YouTube, TikTok, Instagram ou outro vídeo
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="url-title">Título (opcional)</Label>
                      <Input
                        id="url-title"
                        placeholder="Nome do vídeo"
                        value={urlTitle}
                        onChange={(e) => setUrlTitle(e.target.value)}
                        disabled={isProcessing}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="video-url">URL do Vídeo</Label>
                      <Input
                        id="video-url"
                        placeholder="https://youtube.com/watch?v=..."
                        value={videoUrl}
                        onChange={(e) => setVideoUrl(e.target.value)}
                        disabled={isProcessing}
                      />
                    </div>
                    <Button
                      onClick={handleUrlSubmit}
                      disabled={!videoUrl || isProcessing}
                      className="w-full"
                    >
                      {urlMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Baixando e analisando...
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

            {currentVideo && (
              <Card className="mt-4">
                <CardHeader>
                  <CardTitle>{currentVideo.video.title}</CardTitle>
                  <CardDescription>
                    IA identificou {currentVideo.cuts.length} cortes de 1-2 minutos
                  </CardDescription>
                </CardHeader>
              </Card>
            )}
          </div>

          <div>
            <Card>
              <CardHeader>
                <CardTitle>Cortes Identificados</CardTitle>
                <CardDescription>
                  Selecione os cortes para processar
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!currentVideo ? (
                  <div className="text-center py-8">
                    <Scissors className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">
                      Envie um vídeo para ver os cortes
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="space-y-3">
                      {currentVideo.cuts.map((cut, index) => (
                        <div
                          key={cut.id}
                          className={`group relative border rounded-lg p-4 transition-all hover-elevate ${
                            selectedCuts.has(cut.id) 
                              ? "bg-primary/10 border-primary shadow-md" 
                              : "bg-card hover:bg-muted/50"
                          }`}
                        >
                          <div className="absolute top-3 left-3">
                            <div className="flex items-center gap-1">
                              <Sparkles className="h-4 w-4 text-primary" />
                              <Badge variant="default" className="font-semibold">
                                #{index + 1}
                              </Badge>
                            </div>
                          </div>
                          
                          <div className="pl-16 pr-12">
                            <div 
                              className="cursor-pointer"
                              onClick={() => toggleCutSelection(cut.id)}
                            >
                              <div className="flex items-center gap-2 mb-2">
                                <Badge variant="outline" className="text-xs font-mono">
                                  {formatTime(cut.startTime)} → {formatTime(cut.endTime)}
                                </Badge>
                                <Badge variant="secondary" className="text-xs">
                                  {Math.floor((cut.endTime - cut.startTime))}s
                                </Badge>
                                {selectedCuts.has(cut.id) && (
                                  <Badge variant="default" className="text-xs">
                                    <TrendingUp className="h-3 w-3 mr-1" />
                                    Selecionado
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm leading-relaxed">{cut.description}</p>
                            </div>
                          </div>

                          <div className="absolute top-3 right-3 flex gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                setPreviewCut(cut);
                              }}
                              className="h-8 w-8 p-0"
                              data-testid={`button-preview-${cut.id}`}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </div>

                          {selectedCuts.has(cut.id) && (
                            <div className="absolute inset-0 pointer-events-none rounded-lg ring-2 ring-primary ring-offset-2" />
                          )}
                        </div>
                      ))}
                    </div>

                    {selectedCuts.size > 0 && (
                      <div className="space-y-4 pt-4 border-t">
                        <div className="space-y-2">
                          <Label>Formato de Saída</Label>
                          <div className="grid grid-cols-2 gap-2">
                            <Button
                              variant={selectedFormat === "vertical" ? "default" : "outline"}
                              onClick={() => setSelectedFormat("vertical")}
                              className="w-full"
                            >
                              <Smartphone className="h-4 w-4 mr-2" />
                              Reels (9:16)
                            </Button>
                            <Button
                              variant={selectedFormat === "horizontal" ? "default" : "outline"}
                              onClick={() => setSelectedFormat("horizontal")}
                              className="w-full"
                            >
                              <MonitorPlay className="h-4 w-4 mr-2" />
                              HD (16:9)
                            </Button>
                          </div>
                        </div>

                        <Button
                          onClick={handleProcessCuts}
                          disabled={isProcessing}
                          className="w-full"
                        >
                          {processMutation.isPending ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Processando com IA...
                            </>
                          ) : (
                            <>
                              <Download className="h-4 w-4 mr-2" />
                              Processar {selectedCuts.size} {selectedCuts.size === 1 ? "Corte" : "Cortes"}
                            </>
                          )}
                        </Button>
                        <p className="text-xs text-muted-foreground text-center">
                          A IA irá cortar, ajustar formato e gerar legendas automáticas
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      {previewCut && currentVideo && (
        <VideoPreview
          open={previewCut !== null}
          onOpenChange={(open) => !open && setPreviewCut(null)}
          video={currentVideo.video}
          cut={previewCut}
          onUpdateCut={(cutId, startTime, endTime) => {
            updateCutMutation.mutate({ cutId, startTime, endTime });
          }}
        />
      )}
    </div>
  );
}
