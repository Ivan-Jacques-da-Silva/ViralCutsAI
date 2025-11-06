import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function OAuthCallback() {
  const [, setLocation] = useLocation();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const success = params.get('success');
    const error = params.get('error');
    const provider = params.get('provider');
    const accountId = params.get('accountId');

    if (success === 'true' && accountId) {
      setStatus('success');
      setMessage(`Conta conectada com sucesso!`);
      
      if (window.opener) {
        window.opener.postMessage(
          {
            type: 'oauth_success',
            provider,
            accountId,
          },
          window.location.origin
        );
        
        setTimeout(() => {
          window.close();
        }, 1500);
      } else {
        setTimeout(() => {
          setLocation('/accounts');
        }, 2000);
      }
    } else if (error) {
      setStatus('error');
      setMessage(decodeURIComponent(error));
      
      if (window.opener) {
        window.opener.postMessage(
          {
            type: 'oauth_error',
            error: decodeURIComponent(error),
          },
          window.location.origin
        );
        
        setTimeout(() => {
          window.close();
        }, 3000);
      } else {
        setTimeout(() => {
          setLocation('/accounts');
        }, 3000);
      }
    }
  }, [setLocation]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {status === 'loading' && (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Processando...
              </>
            )}
            {status === 'success' && (
              <>
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                Sucesso!
              </>
            )}
            {status === 'error' && (
              <>
                <XCircle className="h-5 w-5 text-red-500" />
                Erro na conexão
              </>
            )}
          </CardTitle>
          <CardDescription>
            {status === 'loading' && 'Autenticando sua conta...'}
            {status === 'success' && 'Esta janela será fechada automaticamente'}
            {status === 'error' && 'Ocorreu um erro durante a autenticação'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {message && (
            <p className="text-sm text-muted-foreground" data-testid="text-oauth-message">
              {message}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
