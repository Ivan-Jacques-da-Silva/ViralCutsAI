import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { SocialAccount } from "@shared/schema";
import { Trash2, Plus, Loader2, CheckCircle2, XCircle, ArrowLeft } from "lucide-react";
import { SiTiktok, SiYoutube, SiInstagram, SiFacebook } from "react-icons/si";
import { OAuthButton } from "@/components/OAuthButton";
import { Link } from "wouter";

export default function Accounts() {
  const [provider, setProvider] = useState<string>("");
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [providerId, setProviderId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const { toast } = useToast();

  const { data: accounts = [], isLoading } = useQuery<SocialAccount[]>({
    queryKey: ["/api/social-accounts"],
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/social-accounts", {
        provider,
        name,
        username: username || null,
        providerId,
        accessToken,
        media: null,
        data: {},
        authorized: true,
      });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/social-accounts"] });
      setProvider("");
      setName("");
      setUsername("");
      setProviderId("");
      setAccessToken("");
      toast({
        title: "Sucesso!",
        description: "Conta adicionada com sucesso",
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

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/social-accounts/${id}`, {});
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/social-accounts"] });
      toast({
        title: "Sucesso!",
        description: "Conta removida com sucesso",
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

  const handleAdd = () => {
    if (!provider || !name || !providerId || !accessToken) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos obrigatórios",
        variant: "destructive",
      });
      return;
    }

    addMutation.mutate();
  };

  const platformIcons: Record<string, any> = {
    tiktok: SiTiktok,
    youtube: SiYoutube,
    instagram: SiInstagram,
    facebook: SiFacebook,
  };

  const platformLabels: Record<string, string> = {
    tiktok: "TikTok",
    youtube: "YouTube",
    instagram: "Instagram",
    facebook: "Facebook",
  };

  const platformHints: Record<string, string> = {
    tiktok: "Obtenha o open_id e access_token através da TikTok API",
    youtube: "Use o ID do canal do YouTube e OAuth 2.0",
    instagram: "Use o Instagram Business Account ID e Page Access Token",
    facebook: "Use o Page ID e Page Access Token",
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4 mb-2">
            <Link href="/">
              <Button variant="ghost" size="sm" data-testid="button-back">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar
              </Button>
            </Link>
          </div>
          <h1 className="text-2xl font-bold">Contas Conectadas</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie suas contas de redes sociais para publicação automatizada
          </p>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Card>
            <CardHeader>
              <CardTitle>Conectar Conta</CardTitle>
              <CardDescription>
                Conecte suas contas de redes sociais de forma rápida e segura
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <h3 className="text-sm font-medium">Conexão Automática (OAuth)</h3>
                <p className="text-xs text-muted-foreground">
                  Clique no botão da plataforma para conectar sua conta de forma segura
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <OAuthButton
                    provider="youtube"
                    label="YouTube"
                    icon={<SiYoutube />}
                    onSuccess={() => {
                      queryClient.invalidateQueries({ queryKey: ["/api/social-accounts"] });
                    }}
                  />
                  <OAuthButton
                    provider="tiktok"
                    label="TikTok"
                    icon={<SiTiktok />}
                    onSuccess={() => {
                      queryClient.invalidateQueries({ queryKey: ["/api/social-accounts"] });
                    }}
                  />
                  <OAuthButton
                    provider="instagram"
                    label="Instagram"
                    icon={<SiInstagram />}
                    onSuccess={() => {
                      queryClient.invalidateQueries({ queryKey: ["/api/social-accounts"] });
                    }}
                  />
                  <OAuthButton
                    provider="facebook"
                    label="Facebook"
                    icon={<SiFacebook />}
                    onSuccess={() => {
                      queryClient.invalidateQueries({ queryKey: ["/api/social-accounts"] });
                    }}
                  />
                </div>
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <Separator />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">
                    Ou conexão manual
                  </span>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="provider">Plataforma *</Label>
                <Select value={provider} onValueChange={setProvider}>
                  <SelectTrigger data-testid="select-platform">
                    <SelectValue placeholder="Selecione uma plataforma" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tiktok">TikTok</SelectItem>
                    <SelectItem value="youtube">YouTube</SelectItem>
                    <SelectItem value="instagram">Instagram</SelectItem>
                    <SelectItem value="facebook">Facebook</SelectItem>
                  </SelectContent>
                </Select>
                {provider && (
                  <p className="text-xs text-muted-foreground">
                    {platformHints[provider]}
                  </p>
                )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="name">Nome da Conta *</Label>
                <Input
                  id="name"
                  data-testid="input-account-name"
                  placeholder="Meu Canal Incrível"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Nome amigável para identificar esta conta
                </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="username">Username (opcional)</Label>
                <Input
                  id="username"
                  data-testid="input-username"
                  placeholder="@meucanalincivel"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="providerId">ID da Conta na Plataforma *</Label>
                <Input
                  id="providerId"
                  data-testid="input-provider-id"
                  placeholder={
                    provider === "youtube" ? "UCxxxxxxxxxxxxxx" :
                    provider === "tiktok" ? "open_id ou user_id" :
                    provider === "instagram" ? "Instagram Business Account ID" :
                    provider === "facebook" ? "Page ID" :
                    "ID da conta"
                  }
                  value={providerId}
                  onChange={(e) => setProviderId(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  ID único da conta na plataforma selecionada
                </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="accessToken">Access Token *</Label>
                <Input
                  id="accessToken"
                  data-testid="input-access-token"
                  type="password"
                  placeholder="cole seu token de acesso aqui"
                  value={accessToken}
                  onChange={(e) => setAccessToken(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Token OAuth obtido no painel de desenvolvedor da plataforma
                </p>
                </div>

                <Button
                  onClick={handleAdd}
                  disabled={addMutation.isPending}
                  className="w-full"
                  data-testid="button-add-account"
                >
                  {addMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Adicionando...
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-2" />
                      Adicionar Manualmente
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Contas Conectadas</CardTitle>
              <CardDescription>
                Gerenciar suas contas de redes sociais ({accounts.length} {accounts.length === 1 ? 'conta' : 'contas'})
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : accounts.length > 0 ? (
                <div className="space-y-3">
                  {accounts.map((account) => {
                    const Icon = platformIcons[account.provider];
                    return (
                      <div
                        key={account.id}
                        className="flex items-center justify-between p-4 rounded-lg border hover-elevate"
                        data-testid={`account-${account.id}`}
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="flex-shrink-0">
                            {Icon && <Icon className="h-5 w-5" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-medium truncate">{account.name}</p>
                              {account.authorized ? (
                                <Badge variant="default" className="flex-shrink-0">
                                  <CheckCircle2 className="h-3 w-3 mr-1" />
                                  Autorizada
                                </Badge>
                              ) : (
                                <Badge variant="destructive" className="flex-shrink-0">
                                  <XCircle className="h-3 w-3 mr-1" />
                                  Não autorizada
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <p className="text-sm text-muted-foreground">
                                {platformLabels[account.provider]}
                              </p>
                              {account.username && (
                                <>
                                  <span className="text-muted-foreground">•</span>
                                  <p className="text-sm text-muted-foreground">
                                    {account.username}
                                  </p>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteMutation.mutate(account.id)}
                          disabled={deleteMutation.isPending}
                          data-testid={`button-delete-${account.id}`}
                          className="flex-shrink-0"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
                    <Plus className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Nenhuma conta conectada ainda
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Adicione sua primeira conta para começar a publicar
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
