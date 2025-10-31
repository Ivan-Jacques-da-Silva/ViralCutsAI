import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface OAuthButtonProps {
  provider: string;
  label: string;
  icon?: React.ReactNode;
  onSuccess?: (accountId: string) => void;
  onError?: (error: string) => void;
}

export function OAuthButton({ provider, label, icon, onSuccess, onError }: OAuthButtonProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const { toast } = useToast();

  const handleConnect = async () => {
    try {
      setIsConnecting(true);

      const response = await fetch(`/api/oauth/connect/${provider}`);
      const data = await response.json();

      if (!response.ok) {
        if (data.setup_required) {
          toast({
            title: "Configuração necessária",
            description: data.error,
            variant: "destructive",
          });
          return;
        }
        throw new Error(data.error || "Erro ao conectar");
      }

      const width = 600;
      const height = 700;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;

      const popup = window.open(
        data.authUrl,
        `oauth_${provider}`,
        `width=${width},height=${height},left=${left},top=${top},toolbar=no,location=no,status=no,menubar=no,scrollbars=yes,resizable=yes`
      );

      if (!popup) {
        toast({
          title: "Pop-up bloqueado",
          description: "Por favor, permita pop-ups para este site",
          variant: "destructive",
        });
        setIsConnecting(false);
        return;
      }

      const handleMessage = (event: MessageEvent) => {
        if (event.origin !== window.location.origin) {
          return;
        }

        if (event.data.type === 'oauth_success') {
          window.removeEventListener('message', handleMessage);
          setIsConnecting(false);
          
          toast({
            title: "Sucesso!",
            description: `Conta ${provider} conectada com sucesso`,
          });
          
          if (onSuccess) {
            onSuccess(event.data.accountId);
          }
        } else if (event.data.type === 'oauth_error') {
          window.removeEventListener('message', handleMessage);
          setIsConnecting(false);
          
          toast({
            title: "Erro na conexão",
            description: event.data.error || "Erro ao conectar conta",
            variant: "destructive",
          });
          
          if (onError) {
            onError(event.data.error);
          }
        }
      };

      window.addEventListener('message', handleMessage);

      const checkClosed = setInterval(() => {
        if (popup.closed) {
          clearInterval(checkClosed);
          window.removeEventListener('message', handleMessage);
          setIsConnecting(false);
        }
      }, 500);

    } catch (error: any) {
      console.error("Erro ao conectar:", error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao conectar conta",
        variant: "destructive",
      });
      setIsConnecting(false);
      
      if (onError) {
        onError(error.message);
      }
    }
  };

  return (
    <Button
      onClick={handleConnect}
      disabled={isConnecting}
      variant="outline"
      className="w-full"
      data-testid={`button-oauth-${provider}`}
    >
      {isConnecting ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Conectando...
        </>
      ) : (
        <>
          {icon && <span className="mr-2">{icon}</span>}
          {label}
        </>
      )}
    </Button>
  );
}
