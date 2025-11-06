import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Info } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function OAuthSetup() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold">Configuração OAuth</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Guia para obter credenciais OAuth das plataformas sociais
          </p>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <Alert className="mb-6">
          <Info className="h-4 w-4" />
          <AlertDescription>
            Para usar a conexão OAuth automática, você precisa configurar as credenciais de cada plataforma
            nas variáveis de ambiente do projeto. Siga os passos abaixo para cada plataforma.
          </AlertDescription>
        </Alert>

        <Tabs defaultValue="youtube" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="youtube">YouTube</TabsTrigger>
            <TabsTrigger value="tiktok">TikTok</TabsTrigger>
            <TabsTrigger value="instagram">Instagram</TabsTrigger>
            <TabsTrigger value="facebook">Facebook</TabsTrigger>
          </TabsList>

          <TabsContent value="youtube" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  YouTube / Google OAuth
                  <Badge>Google Cloud Console</Badge>
                </CardTitle>
                <CardDescription>
                  Configure o OAuth 2.0 através do Google Cloud Console
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <h3 className="font-medium">Passo 1: Criar Projeto</h3>
                  <p className="text-sm text-muted-foreground">
                    Acesse o{" "}
                    <a
                      href="https://console.cloud.google.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline inline-flex items-center gap-1"
                    >
                      Google Cloud Console <ExternalLink className="h-3 w-3" />
                    </a>{" "}
                    e crie um novo projeto
                  </p>
                </div>

                <div className="space-y-2">
                  <h3 className="font-medium">Passo 2: Ativar YouTube Data API v3</h3>
                  <p className="text-sm text-muted-foreground">
                    No menu, vá em "APIs & Services" → "Library" e ative a YouTube Data API v3
                  </p>
                </div>

                <div className="space-y-2">
                  <h3 className="font-medium">Passo 3: Criar Credenciais OAuth</h3>
                  <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                    <li>Vá em "APIs & Services" → "Credentials"</li>
                    <li>Clique em "Create Credentials" → "OAuth client ID"</li>
                    <li>Escolha "Web application"</li>
                    <li>Adicione o redirect URI: <code className="bg-muted px-1 py-0.5 rounded text-xs">https://seu-dominio.repl.co/api/oauth/callback/youtube</code></li>
                  </ul>
                </div>

                <div className="space-y-2">
                  <h3 className="font-medium">Passo 4: Configurar Variáveis de Ambiente</h3>
                  <div className="bg-muted p-3 rounded-md font-mono text-xs space-y-1">
                    <div>GOOGLE_CLIENT_ID=seu_client_id</div>
                    <div>GOOGLE_CLIENT_SECRET=seu_client_secret</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tiktok" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  TikTok OAuth
                  <Badge>TikTok for Developers</Badge>
                </CardTitle>
                <CardDescription>
                  Configure o OAuth através do TikTok for Developers
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <h3 className="font-medium">Passo 1: Criar Aplicação</h3>
                  <p className="text-sm text-muted-foreground">
                    Acesse{" "}
                    <a
                      href="https://developers.tiktok.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline inline-flex items-center gap-1"
                    >
                      TikTok for Developers <ExternalLink className="h-3 w-3" />
                    </a>{" "}
                    e crie uma nova aplicação
                  </p>
                </div>

                <div className="space-y-2">
                  <h3 className="font-medium">Passo 2: Configurar OAuth</h3>
                  <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                    <li>Adicione o redirect URI na configuração do app</li>
                    <li>URI: <code className="bg-muted px-1 py-0.5 rounded text-xs">https://seu-dominio.repl.co/api/oauth/callback/tiktok</code></li>
                    <li>Solicite as permissões: user.info.basic, video.list, video.upload</li>
                  </ul>
                </div>

                <div className="space-y-2">
                  <h3 className="font-medium">Passo 3: Configurar Variáveis de Ambiente</h3>
                  <div className="bg-muted p-3 rounded-md font-mono text-xs space-y-1">
                    <div>TIKTOK_CLIENT_KEY=seu_client_key</div>
                    <div>TIKTOK_CLIENT_SECRET=seu_client_secret</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="instagram" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Instagram OAuth
                  <Badge>Meta for Developers</Badge>
                </CardTitle>
                <CardDescription>
                  Configure através do Meta for Developers (Facebook)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <h3 className="font-medium">Passo 1: Criar App no Facebook</h3>
                  <p className="text-sm text-muted-foreground">
                    Acesse{" "}
                    <a
                      href="https://developers.facebook.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline inline-flex items-center gap-1"
                    >
                      Meta for Developers <ExternalLink className="h-3 w-3" />
                    </a>{" "}
                    e crie uma nova aplicação
                  </p>
                </div>

                <div className="space-y-2">
                  <h3 className="font-medium">Passo 2: Adicionar Produto Instagram</h3>
                  <p className="text-sm text-muted-foreground">
                    Adicione o produto "Instagram Basic Display" ou "Instagram Graph API" ao seu app
                  </p>
                </div>

                <div className="space-y-2">
                  <h3 className="font-medium">Passo 3: Configurar OAuth Redirect</h3>
                  <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                    <li>Adicione Valid OAuth Redirect URIs</li>
                    <li>URI: <code className="bg-muted px-1 py-0.5 rounded text-xs">https://seu-dominio.repl.co/api/oauth/callback/instagram</code></li>
                  </ul>
                </div>

                <div className="space-y-2">
                  <h3 className="font-medium">Passo 4: Configurar Variáveis de Ambiente</h3>
                  <div className="bg-muted p-3 rounded-md font-mono text-xs space-y-1">
                    <div>INSTAGRAM_CLIENT_ID=seu_app_id</div>
                    <div>INSTAGRAM_CLIENT_SECRET=seu_app_secret</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="facebook" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Facebook OAuth
                  <Badge>Meta for Developers</Badge>
                </CardTitle>
                <CardDescription>
                  Configure através do Meta for Developers
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <h3 className="font-medium">Passo 1: Criar App no Facebook</h3>
                  <p className="text-sm text-muted-foreground">
                    Acesse{" "}
                    <a
                      href="https://developers.facebook.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline inline-flex items-center gap-1"
                    >
                      Meta for Developers <ExternalLink className="h-3 w-3" />
                    </a>{" "}
                    e crie uma nova aplicação
                  </p>
                </div>

                <div className="space-y-2">
                  <h3 className="font-medium">Passo 2: Adicionar Facebook Login</h3>
                  <p className="text-sm text-muted-foreground">
                    Adicione o produto "Facebook Login" ao seu app
                  </p>
                </div>

                <div className="space-y-2">
                  <h3 className="font-medium">Passo 3: Configurar OAuth Redirect URIs</h3>
                  <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                    <li>Em Facebook Login Settings, adicione Valid OAuth Redirect URIs</li>
                    <li>URI: <code className="bg-muted px-1 py-0.5 rounded text-xs">https://seu-dominio.repl.co/api/oauth/callback/facebook</code></li>
                  </ul>
                </div>

                <div className="space-y-2">
                  <h3 className="font-medium">Passo 4: Configurar Variáveis de Ambiente</h3>
                  <div className="bg-muted p-3 rounded-md font-mono text-xs space-y-1">
                    <div>FACEBOOK_APP_ID=seu_app_id</div>
                    <div>FACEBOOK_APP_SECRET=seu_app_secret</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Alert className="mt-6">
          <Info className="h-4 w-4" />
          <AlertDescription>
            <strong>Nota:</strong> Após configurar as variáveis de ambiente, reinicie o servidor para que
            as alterações tenham efeito. As credenciais OAuth são mantidas seguras no servidor e nunca
            são expostas ao cliente.
          </AlertDescription>
        </Alert>
      </main>
    </div>
  );
}
