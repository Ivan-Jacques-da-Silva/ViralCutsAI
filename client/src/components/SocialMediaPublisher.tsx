import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { 
  Upload, 
  Wand2, 
  Send, 
  Eye, 
  Settings, 
  Plus, 
  Trash2, 
  ExternalLink,
  CheckCircle,
  XCircle,
  Clock,
  Sparkles
} from 'lucide-react';

interface Platform {
  id: string;
  name: string;
  description: string;
  icon: string;
  maxDuration: number | null;
  supportedFormats: string[];
}

interface ConnectedAccount {
  id: string;
  platform: string;
  accountName: string;
  isActive: boolean;
  createdAt: string;
  expiresAt?: string;
}

interface GeneratedContent {
  titles: string[];
  descriptions: string[];
  hashtags: string[];
  suggestions: {
    bestTitle: string;
    bestDescription: string;
    recommendedHashtags: string[];
    platformSpecific: Record<string, any>;
  };
}

interface PublishResult {
  platform: string;
  success: boolean;
  postId?: string;
  postUrl?: string;
  error?: string;
}

export default function SocialMediaPublisher() {
  const { toast } = useToast();
  
  // Estados principais
  const [activeTab, setActiveTab] = useState('upload');
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [connectedAccounts, setConnectedAccounts] = useState<ConnectedAccount[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isGeneratingContent, setIsGeneratingContent] = useState(false);
  
  // Estados do formulário
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [newHashtag, setNewHashtag] = useState('');
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [privacy, setPrivacy] = useState('public');
  
  // Estados de geração de conteúdo
  const [generateContent, setGenerateContent] = useState(false);
  const [contentTone, setContentTone] = useState('casual');
  const [targetAudience, setTargetAudience] = useState('');
  const [keywords, setKeywords] = useState<string[]>([]);
  const [generatedContent, setGeneratedContent] = useState<GeneratedContent | null>(null);
  
  // Estados de resultados
  const [publishResults, setPublishResults] = useState<PublishResult[]>([]);
  const [previewData, setPreviewData] = useState<any>(null);

  // Carrega dados iniciais
  useEffect(() => {
    loadPlatforms();
    loadConnectedAccounts();
  }, []);

  const loadPlatforms = async () => {
    try {
      const response = await fetch('/api/social-media/platforms');
      const data = await response.json();
      if (data.success) {
        setPlatforms(data.platforms);
      }
    } catch (error) {
      console.error('Erro ao carregar plataformas:', error);
    }
  };

  const loadConnectedAccounts = async () => {
    try {
      const response = await fetch('/api/social-media/accounts');
      const data = await response.json();
      if (data.success) {
        setConnectedAccounts(data.accounts);
      }
    } catch (error) {
      console.error('Erro ao carregar contas:', error);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      if (!title) {
        setTitle(file.name.replace(/\.[^/.]+$/, ''));
      }
    }
  };

  const addHashtag = () => {
    if (newHashtag.trim() && !hashtags.includes(newHashtag.trim())) {
      setHashtags([...hashtags, newHashtag.trim()]);
      setNewHashtag('');
    }
  };

  const removeHashtag = (index: number) => {
    setHashtags(hashtags.filter((_, i) => i !== index));
  };

  const addKeyword = (keyword: string) => {
    if (keyword.trim() && !keywords.includes(keyword.trim())) {
      setKeywords([...keywords, keyword.trim()]);
    }
  };

  const generateContentWithAI = async () => {
    if (!selectedFile) {
      toast({
        title: 'Erro',
        description: 'Selecione um vídeo primeiro',
        variant: 'destructive'
      });
      return;
    }

    setIsGeneratingContent(true);
    try {
      const formData = new FormData();
      formData.append('video', selectedFile);
      formData.append('platforms', JSON.stringify(getSelectedPlatforms()));
      formData.append('tone', contentTone);
      formData.append('targetAudience', targetAudience);
      formData.append('keywords', JSON.stringify(keywords));

      const response = await fetch('/api/social-media/generate-content', {
        method: 'POST',
        body: formData
      });

      const data = await response.json();
      if (data.success) {
        setGeneratedContent(data.content);
        
        // Aplica sugestões automaticamente
        if (data.content.suggestions.bestTitle) {
          setTitle(data.content.suggestions.bestTitle);
        }
        if (data.content.suggestions.bestDescription) {
          setDescription(data.content.suggestions.bestDescription);
        }
        if (data.content.suggestions.recommendedHashtags) {
          setHashtags(data.content.suggestions.recommendedHashtags);
        }

        toast({
          title: 'Sucesso!',
          description: 'Conteúdo gerado com IA com sucesso'
        });
      } else {
        throw new Error(data.error || 'Erro ao gerar conteúdo');
      }
    } catch (error) {
      console.error('Erro ao gerar conteúdo:', error);
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Erro ao gerar conteúdo',
        variant: 'destructive'
      });
    } finally {
      setIsGeneratingContent(false);
    }
  };

  const generatePreview = async () => {
    if (!selectedFile || selectedAccounts.length === 0) {
      toast({
        title: 'Erro',
        description: 'Selecione um vídeo e pelo menos uma conta',
        variant: 'destructive'
      });
      return;
    }

    try {
      const formData = new FormData();
      formData.append('video', selectedFile);
      formData.append('title', title);
      formData.append('description', description);
      formData.append('hashtags', JSON.stringify(hashtags));
      formData.append('accounts', JSON.stringify(selectedAccounts));
      formData.append('generateContent', generateContent.toString());
      
      if (generateContent) {
        formData.append('contentOptions', JSON.stringify({
          tone: contentTone,
          targetAudience,
          keywords
        }));
      }

      const response = await fetch('/api/social-media/preview', {
        method: 'POST',
        body: formData
      });

      const data = await response.json();
      if (data.success) {
        setPreviewData(data.preview);
        setActiveTab('preview');
      } else {
        throw new Error(data.error || 'Erro ao gerar preview');
      }
    } catch (error) {
      console.error('Erro ao gerar preview:', error);
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Erro ao gerar preview',
        variant: 'destructive'
      });
    }
  };

  const publishContent = async () => {
    if (!selectedFile || selectedAccounts.length === 0) {
      toast({
        title: 'Erro',
        description: 'Selecione um vídeo e pelo menos uma conta',
        variant: 'destructive'
      });
      return;
    }

    setIsPublishing(true);
    setPublishResults([]);

    try {
      const formData = new FormData();
      formData.append('video', selectedFile);
      formData.append('title', title);
      formData.append('description', description);
      formData.append('hashtags', JSON.stringify(hashtags));
      formData.append('accounts', JSON.stringify(selectedAccounts));
      formData.append('privacy', privacy);
      formData.append('generateContent', generateContent.toString());
      
      if (generateContent) {
        formData.append('contentOptions', JSON.stringify({
          tone: contentTone,
          targetAudience,
          keywords
        }));
      }

      const response = await fetch('/api/social-media/publish', {
        method: 'POST',
        body: formData
      });

      const data = await response.json();
      setPublishResults(data.results || []);

      if (data.success) {
        toast({
          title: 'Sucesso!',
          description: 'Conteúdo publicado com sucesso'
        });
        setActiveTab('results');
      } else {
        toast({
          title: 'Erro na publicação',
          description: data.errors?.join(', ') || 'Erro desconhecido',
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Erro ao publicar:', error);
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Erro ao publicar',
        variant: 'destructive'
      });
    } finally {
      setIsPublishing(false);
    }
  };

  const connectAccount = async (platform: string) => {
    try {
      const response = await fetch(`/api/social-media/auth/${platform}`);
      const data = await response.json();
      
      if (data.success) {
        // Abre popup para autorização
        const popup = window.open(
          data.authUrl,
          'social-auth',
          'width=600,height=700,scrollbars=yes,resizable=yes'
        );

        // Monitora o popup para capturar o código de autorização
        const checkClosed = setInterval(() => {
          if (popup?.closed) {
            clearInterval(checkClosed);
            // Recarrega contas após possível conexão
            setTimeout(() => loadConnectedAccounts(), 1000);
          }
        }, 1000);
      }
    } catch (error) {
      console.error('Erro ao conectar conta:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao conectar conta',
        variant: 'destructive'
      });
    }
  };

  const disconnectAccount = async (accountId: string) => {
    try {
      const response = await fetch(`/api/social-media/accounts/${accountId}`, {
        method: 'DELETE'
      });

      const data = await response.json();
      if (data.success) {
        setConnectedAccounts(accounts => accounts.filter(acc => acc.id !== accountId));
        setSelectedAccounts(selected => selected.filter(id => id !== accountId));
        toast({
          title: 'Sucesso',
          description: 'Conta desconectada com sucesso'
        });
      }
    } catch (error) {
      console.error('Erro ao desconectar conta:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao desconectar conta',
        variant: 'destructive'
      });
    }
  };

  const getSelectedPlatforms = () => {
    return selectedAccounts.map(accountId => {
      const account = connectedAccounts.find(acc => acc.id === accountId);
      return account?.platform || '';
    }).filter(Boolean);
  };

  const getPlatformIcon = (platform: string) => {
    const platformData = platforms.find(p => p.id === platform);
    return platformData?.icon || '📱';
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">Publicador de Redes Sociais</h1>
        <p className="text-muted-foreground">
          Publique seus vídeos em múltiplas redes sociais com IA
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="upload">Upload</TabsTrigger>
          <TabsTrigger value="content">Conteúdo</TabsTrigger>
          <TabsTrigger value="accounts">Contas</TabsTrigger>
          <TabsTrigger value="preview">Preview</TabsTrigger>
          <TabsTrigger value="results">Resultados</TabsTrigger>
        </TabsList>

        {/* Tab Upload */}
        <TabsContent value="upload" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Upload de Vídeo
              </CardTitle>
              <CardDescription>
                Selecione o vídeo que deseja publicar nas redes sociais
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center">
                <input
                  type="file"
                  accept="video/*"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="video-upload"
                />
                <label htmlFor="video-upload" className="cursor-pointer">
                  <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-lg font-medium">
                    {selectedFile ? selectedFile.name : 'Clique para selecionar um vídeo'}
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Suporta MP4, MOV, AVI e outros formatos
                  </p>
                </label>
              </div>

              {selectedFile && (
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    Vídeo selecionado: {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab Conteúdo */}
        <TabsContent value="content" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Formulário de conteúdo */}
            <Card>
              <CardHeader>
                <CardTitle>Informações do Post</CardTitle>
                <CardDescription>
                  Configure o título, descrição e hashtags
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Título</Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Digite o título do vídeo"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Descrição</Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Digite a descrição do vídeo"
                    rows={4}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Hashtags</Label>
                  <div className="flex gap-2">
                    <Input
                      value={newHashtag}
                      onChange={(e) => setNewHashtag(e.target.value)}
                      placeholder="Digite uma hashtag"
                      onKeyPress={(e) => e.key === 'Enter' && addHashtag()}
                    />
                    <Button onClick={addHashtag} size="sm">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {hashtags.map((tag, index) => (
                      <Badge key={index} variant="secondary" className="flex items-center gap-1">
                        #{tag}
                        <button
                          onClick={() => removeHashtag(index)}
                          className="ml-1 hover:text-destructive"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="privacy">Privacidade</Label>
                  <Select value={privacy} onValueChange={setPrivacy}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="public">Público</SelectItem>
                      <SelectItem value="private">Privado</SelectItem>
                      <SelectItem value="unlisted">Não listado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Geração com IA */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wand2 className="h-5 w-5" />
                  Geração com IA
                </CardTitle>
                <CardDescription>
                  Use IA para gerar conteúdo otimizado
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="generate-content"
                    checked={generateContent}
                    onCheckedChange={(checked) => setGenerateContent(checked as boolean)}
                  />
                  <Label htmlFor="generate-content">Gerar conteúdo com IA</Label>
                </div>

                {generateContent && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="tone">Tom do conteúdo</Label>
                      <Select value={contentTone} onValueChange={setContentTone}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="casual">Casual</SelectItem>
                          <SelectItem value="professional">Profissional</SelectItem>
                          <SelectItem value="funny">Engraçado</SelectItem>
                          <SelectItem value="inspiring">Inspirador</SelectItem>
                          <SelectItem value="educational">Educativo</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="audience">Público-alvo</Label>
                      <Input
                        id="audience"
                        value={targetAudience}
                        onChange={(e) => setTargetAudience(e.target.value)}
                        placeholder="Ex: jovens interessados em tecnologia"
                      />
                    </div>

                    <Button
                      onClick={generateContentWithAI}
                      disabled={isGeneratingContent || !selectedFile}
                      className="w-full"
                    >
                      {isGeneratingContent ? (
                        <>
                          <Clock className="h-4 w-4 mr-2 animate-spin" />
                          Gerando conteúdo...
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4 mr-2" />
                          Gerar conteúdo com IA
                        </>
                      )}
                    </Button>
                  </>
                )}

                {generatedContent && (
                  <Alert>
                    <Sparkles className="h-4 w-4" />
                    <AlertDescription>
                      Conteúdo gerado com sucesso! As sugestões foram aplicadas automaticamente.
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tab Contas */}
        <TabsContent value="accounts" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Plataformas disponíveis */}
            <Card>
              <CardHeader>
                <CardTitle>Plataformas Disponíveis</CardTitle>
                <CardDescription>
                  Conecte suas contas de redes sociais
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {platforms.map((platform) => (
                    <div key={platform.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{platform.icon}</span>
                        <div>
                          <h3 className="font-medium">{platform.name}</h3>
                          <p className="text-sm text-muted-foreground">{platform.description}</p>
                        </div>
                      </div>
                      <Button
                        onClick={() => connectAccount(platform.id)}
                        size="sm"
                        variant="outline"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Conectar
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Contas conectadas */}
            <Card>
              <CardHeader>
                <CardTitle>Contas Conectadas</CardTitle>
                <CardDescription>
                  Gerencie suas contas conectadas
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  <div className="space-y-4">
                    {connectedAccounts.length === 0 ? (
                      <p className="text-center text-muted-foreground py-8">
                        Nenhuma conta conectada
                      </p>
                    ) : (
                      connectedAccounts.map((account) => (
                        <div key={account.id} className="flex items-center justify-between p-4 border rounded-lg">
                          <div className="flex items-center gap-3">
                            <Checkbox
                              checked={selectedAccounts.includes(account.id)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setSelectedAccounts([...selectedAccounts, account.id]);
                                } else {
                                  setSelectedAccounts(selectedAccounts.filter(id => id !== account.id));
                                }
                              }}
                            />
                            <span className="text-xl">{getPlatformIcon(account.platform)}</span>
                            <div>
                              <h3 className="font-medium">{account.accountName}</h3>
                              <p className="text-sm text-muted-foreground capitalize">
                                {account.platform}
                              </p>
                            </div>
                          </div>
                          <Button
                            onClick={() => disconnectAccount(account.id)}
                            size="sm"
                            variant="outline"
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tab Preview */}
        <TabsContent value="preview" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Preview da Publicação
              </CardTitle>
              <CardDescription>
                Visualize como seu conteúdo aparecerá nas redes sociais
              </CardDescription>
            </CardHeader>
            <CardContent>
              {previewData ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h3 className="font-semibold mb-2">Conteúdo Final</h3>
                      <div className="space-y-2 p-4 bg-muted rounded-lg">
                        <p><strong>Título:</strong> {previewData.content.title}</p>
                        <p><strong>Descrição:</strong> {previewData.content.description}</p>
                        <div>
                          <strong>Hashtags:</strong>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {previewData.content.hashtags.map((tag: string, index: number) => (
                              <Badge key={index} variant="secondary">#{tag}</Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div>
                      <h3 className="font-semibold mb-2">Informações do Vídeo</h3>
                      <div className="space-y-2 p-4 bg-muted rounded-lg">
                        <p><strong>Arquivo:</strong> {previewData.videoInfo.filename}</p>
                        <p><strong>Tamanho:</strong> {(previewData.videoInfo.size / 1024 / 1024).toFixed(2)} MB</p>
                        <p><strong>Tipo:</strong> {previewData.videoInfo.mimetype}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <Button onClick={generatePreview} variant="outline">
                      <Eye className="h-4 w-4 mr-2" />
                      Atualizar Preview
                    </Button>
                    <Button
                      onClick={publishContent}
                      disabled={isPublishing}
                      className="flex-1"
                    >
                      {isPublishing ? (
                        <>
                          <Clock className="h-4 w-4 mr-2 animate-spin" />
                          Publicando...
                        </>
                      ) : (
                        <>
                          <Send className="h-4 w-4 mr-2" />
                          Publicar Agora
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground mb-4">
                    Nenhum preview disponível
                  </p>
                  <Button onClick={generatePreview} disabled={!selectedFile || selectedAccounts.length === 0}>
                    <Eye className="h-4 w-4 mr-2" />
                    Gerar Preview
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab Resultados */}
        <TabsContent value="results" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Resultados da Publicação</CardTitle>
              <CardDescription>
                Status das publicações em cada rede social
              </CardDescription>
            </CardHeader>
            <CardContent>
              {publishResults.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">
                    Nenhuma publicação realizada ainda
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {publishResults.map((result, index) => (
                    <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{getPlatformIcon(result.platform)}</span>
                        <div>
                          <h3 className="font-medium capitalize">{result.platform}</h3>
                          {result.success ? (
                            <p className="text-sm text-green-600">Publicado com sucesso</p>
                          ) : (
                            <p className="text-sm text-red-600">{result.error}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {result.success ? (
                          <CheckCircle className="h-5 w-5 text-green-600" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-600" />
                        )}
                        {result.postUrl && (
                          <Button size="sm" variant="outline" asChild>
                            <a href={result.postUrl} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}